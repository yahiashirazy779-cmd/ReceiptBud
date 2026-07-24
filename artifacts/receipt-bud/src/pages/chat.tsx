import { useState, useRef, useEffect } from "react";
import { BudMascot } from "@/components/ui/bud-mascot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, User, Loader2 } from "lucide-react";
import { useListGeminiConversations, useCreateGeminiConversation, useListGeminiMessages, getListGeminiMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Chat() {
  const [input, setInput] = useState("");
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: convos } = useListGeminiConversations();
  const createConv = useCreateGeminiConversation();
  
  const { data: messages = [], refetch: refetchMessages } = useListGeminiMessages(activeConvId || 0, {
    query: { enabled: !!activeConvId, queryKey: getListGeminiMessagesQueryKey(activeConvId || 0) }
  });

  useEffect(() => {
    if (convos && convos.length > 0 && !activeConvId) {
      setActiveConvId(convos[0].id);
    }
  }, [convos, activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    let convId = activeConvId;
    
    // Create new conv if none exists
    if (!convId) {
      const newConv = await createConv.mutateAsync({ data: { title: "New Chat" } });
      convId = newConv.id;
      setActiveConvId(convId);
    }

    const userMessage = input;
    setInput("");
    
    // Optimistically update UI
    const tempUserMsg = { id: Date.now(), role: "user", content: userMessage, createdAt: new Date().toISOString() };
    queryClient.setQueryData(['getGeminiMessages', convId], (old: any) => [...(old || []), tempUserMsg]);

    setIsStreaming(true);
    setStreamingText("");

    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${basePath}/api/gemini/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage }),
        credentials: 'include',
      });
      
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingText(fullResponse);
              }
            } catch(e) {}
          }
        }
      }
      
      // Refresh to get actual DB messages
      await refetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  };

  const suggestions = [
    "Where did my money go this month?",
    "Am I overspending on dining?",
    "Which category costs the most?",
  ];

  return (
    <div className="flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full relative">
        <header className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center gap-3 z-10">
          <BudMascot size={40} emotion="happy" floating={false} />
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white">Chat with Bud</h1>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {(!messages || messages.length === 0) && !isStreaming && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-80 mt-10">
              <BudMascot size={120} emotion="wave" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-6 mb-2">I'm Bud, your financial sidekick!</h2>
              <p className="text-slate-500 max-w-sm mb-8">
                I can analyze your spending, check budgets, and help you find ways to save. Just ask!
              </p>
              
              <div className="flex flex-col gap-2 w-full max-w-md">
                {suggestions.map((s, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(s)}
                    className="p-3 text-sm text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-emerald-500 hover:shadow-sm transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg: any, i: number) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600' : 'bg-transparent'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <BudMascot size={40} floating={false} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-emerald-500 text-white rounded-tr-sm' 
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm'
              }`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full flex-shrink-0 bg-transparent flex justify-center">
                <BudMascot size={40} emotion="think" floating={false} />
              </div>
              <div className="max-w-[80%] rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm">
                {streamingText ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamingText}<span className="inline-block w-1.5 h-4 ml-1 bg-emerald-500 animate-pulse" /></p>
                ) : (
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce delay-75" />
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce delay-150" />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 max-w-4xl mx-auto"
          >
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
              <Input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask Bud anything about your money..."
                className="w-full pl-10 pr-4 h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-emerald-500 shadow-sm"
                disabled={isStreaming}
              />
            </div>
            <Button 
              type="submit" 
              disabled={!input.trim() || isStreaming}
              className="h-12 w-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 p-0 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
