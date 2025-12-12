import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to search with Perplexity for current information
async function searchWithPerplexity(query: string): Promise<{ content: string; citations: string[] } | null> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  
  if (!PERPLEXITY_API_KEY) {
    console.log('PERPLEXITY_API_KEY not configured, skipping search');
    return null;
  }

  try {
    console.log('Searching Perplexity for:', query);
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Provide current, factual, up-to-date information. Be concise and accurate.' },
          { role: 'user', content: query }
        ],
      }),
    });

    if (!response.ok) {
      console.error('Perplexity search failed:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      citations: data.citations || []
    };
  } catch (error) {
    console.error('Perplexity search error:', error);
    return null;
  }
}

// Check if the query needs current/real-time information
function needsCurrentInfo(message: string): boolean {
  const currentInfoKeywords = [
    'today', 'current', 'latest', 'now', 'recent', 'news', 'weather', 
    '2024', '2025', 'price', 'stock', 'score', 'result', 'update',
    'aaj', 'abhi', 'latest', 'naya', 'news', 'khabar', 'score',
    'who is', 'what is', 'when is', 'where is', 'how much',
    'president', 'prime minister', 'ceo', 'match', 'game'
  ];
  
  const lowerMessage = message.toLowerCase();
  return currentInfoKeywords.some(keyword => lowerMessage.includes(keyword));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat request with', messages.length, 'messages');

    // Get the latest user message
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    let searchContext = '';

    // If the message seems to need current info, search with Perplexity first
    if (lastUserMessage && needsCurrentInfo(lastUserMessage.content)) {
      console.log('Query needs current info, searching with Perplexity...');
      const searchResult = await searchWithPerplexity(lastUserMessage.content);
      
      if (searchResult) {
        searchContext = `\n\n[REAL-TIME SEARCH RESULTS - Use this information to answer the user's question accurately]\n${searchResult.content}\n\nSources: ${searchResult.citations.join(', ')}`;
        console.log('Got search results, adding to context');
      }
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are Nova, a friendly and helpful AI assistant with real-time web search capabilities.

IMPORTANT: Today's date is ${currentDate}. You have access to current information through web search.
${searchContext}

Your personality traits:
- Warm, approachable, and conversational
- Concise but thorough in explanations
- Uses occasional emojis to add warmth (but not excessively)
- Admits when you don't know something
- Asks clarifying questions when needed
- Remembers context from the conversation
- ALWAYS provide current and up-to-date information when available

When you have search results, use them to provide accurate, current information. Cite sources when relevant.

Keep responses helpful and engaging. Format responses with markdown when appropriate for code, lists, or emphasis.`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    console.log('Streaming response started');

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
