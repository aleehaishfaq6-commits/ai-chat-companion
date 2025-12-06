import { Plus, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onNewChat: () => void;
  onClearHistory: () => void;
  hasMessages: boolean;
}

const ChatHeader = ({ onNewChat, onClearHistory, hasMessages }: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between p-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30 animate-pulse-glow">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-lg text-foreground">Nova AI</h1>
          <p className="text-xs text-muted-foreground">Your intelligent assistant</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          className="gap-2 bg-secondary/50 border-border/50 hover:bg-secondary hover:border-primary/50 text-foreground"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
        
        {hasMessages && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            className="gap-2 bg-secondary/50 border-border/50 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive text-foreground"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>
    </header>
  );
};

export default ChatHeader;
