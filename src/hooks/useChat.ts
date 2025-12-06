import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation on mount
  useEffect(() => {
    loadOrCreateConversation();
  }, []);

  const loadOrCreateConversation = async () => {
    try {
      // Try to get the most recent conversation
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (conversations && conversations.length > 0) {
        const convId = conversations[0].id;
        setConversationId(convId);
        
        // Load messages for this conversation
        const { data: msgs, error: msgsError } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (msgsError) throw msgsError;
        
        if (msgs) {
          setMessages(
            msgs.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      } else {
        // Create a new conversation
        await createNewConversation();
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const createNewConversation = async () => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title: "New Chat" })
        .select()
        .single();

      if (error) throw error;
      
      setConversationId(data.id);
      setMessages([]);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId) {
      toast.error("No active conversation");
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Save user message to database
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
      });

      // Prepare messages for API
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call the chat function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      // Create assistant message placeholder
      const assistantId = crypto.randomUUID();
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE lines
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  )
                );
              }
            } catch {
              // Incomplete JSON, wait for more data
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      }

      // Save assistant message to database
      if (assistantContent) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantContent,
        });

        // Update conversation title if first message
        if (messages.length === 0) {
          const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
          await supabase
            .from("conversations")
            .update({ title })
            .eq("id", conversationId);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error sending message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
      // Remove the failed assistant message
      setMessages((prev) => prev.filter((m) => m.role !== "assistant" || m.content));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, messages]);

  const clearHistory = useCallback(async () => {
    if (!conversationId) return;

    try {
      // Delete current conversation (cascade deletes messages)
      await supabase.from("conversations").delete().eq("id", conversationId);
      
      // Create a new conversation
      await createNewConversation();
      
      toast.success("Chat cleared");
    } catch (error) {
      console.error("Error clearing history:", error);
      toast.error("Failed to clear history");
    }
  }, [conversationId]);

  const startNewChat = useCallback(async () => {
    await createNewConversation();
    toast.success("Started new chat");
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    startNewChat,
  };
};
