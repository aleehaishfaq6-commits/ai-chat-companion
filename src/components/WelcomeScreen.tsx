import { Sparkles, MessageSquare, Zap, Brain } from "lucide-react";

const WelcomeScreen = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "Natural Conversation",
      description: "Chat naturally with context awareness",
    },
    {
      icon: Zap,
      title: "Instant Responses",
      description: "Get quick, helpful answers in real-time",
    },
    {
      icon: Brain,
      title: "Smart & Adaptive",
      description: "Learns from context to give better answers",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30 mb-6 animate-pulse-glow">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2">
        Welcome to Nova AI
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        I'm your intelligent assistant, ready to help with questions, tasks, and creative ideas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="p-4 rounded-xl bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <feature.icon className="w-8 h-8 text-primary mb-3 mx-auto" />
            <h3 className="font-medium text-foreground text-sm mb-1">
              {feature.title}
            </h3>
            <p className="text-xs text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mt-8">
        Type a message below to start chatting ✨
      </p>
    </div>
  );
};

export default WelcomeScreen;
