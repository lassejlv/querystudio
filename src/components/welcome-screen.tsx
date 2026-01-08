import { useEffect, useRef } from "react";
import { Database, Plus, Server, Sparkles, Zap, Terminal, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSavedConnections } from "@/lib/hooks";
import { getLastConnectionId } from "@/lib/store";
import type { SavedConnection } from "@/lib/types";

interface WelcomeScreenProps {
  onNewConnection: () => void;
  onSelectConnection: (connection: SavedConnection) => void;
}

export function WelcomeScreen({ onNewConnection, onSelectConnection }: WelcomeScreenProps) {
  const { data: savedConnections, isLoading } = useSavedConnections();
  const autoConnectAttempted = useRef(false);

  // Auto-connect to last connection
  useEffect(() => {
    if (isLoading || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    
    const lastConnectionId = getLastConnectionId();
    if (lastConnectionId && savedConnections) {
      const lastConnection = savedConnections.find(c => c.id === lastConnectionId);
      if (lastConnection) {
        onSelectConnection(lastConnection);
      }
    }
  }, [isLoading, savedConnections, onSelectConnection]);

  const getConnectionDescription = (connection: SavedConnection) => {
    if ("connection_string" in connection.config) {
      return "Connection string";
    }
    return `${connection.config.host}:${connection.config.port}/${connection.config.database}`;
  };

  const features = [
    { icon: Terminal, label: "Query Editor", desc: "Write and execute SQL" },
    { icon: Sparkles, label: "AI Assistant", desc: "Natural language to SQL" },
    { icon: Zap, label: "Fast & Native", desc: "Built with Rust" },
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
      {/* Draggable title bar region */}
      <div 
        data-tauri-drag-region 
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      
      <div className="flex flex-1">
        {/* Left side - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 relative overflow-hidden">
          {/* Gradient background effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <span className="text-2xl font-semibold text-foreground">QueryStudio</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-bold text-foreground mb-4 leading-tight"
            >
              A modern PostgreSQL
              <br />
              <span className="text-primary">client for developers</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-10 max-w-md"
            >
              Explore your databases, write queries, and let AI help you work faster.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-4"
            >
              {features.map((feature, idx) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + idx * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <feature.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
        
        {/* Right side - Connection Panel */}
        <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            {/* Mobile logo - only shown on smaller screens */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-semibold text-foreground">QueryStudio</span>
            </div>
            
            <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {savedConnections && savedConnections.length > 0 ? "Welcome back" : "Get started"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {savedConnections && savedConnections.length > 0 
                  ? "Select a connection or create a new one"
                  : "Connect to a PostgreSQL database to begin"
                }
              </p>
              
              {/* Saved Connections */}
              {!isLoading && savedConnections && savedConnections.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                    Recent Connections
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {savedConnections.map((connection, idx) => (
                      <motion.button
                        key={connection.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onSelectConnection(connection)}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all group"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border border-border">
                          <Server className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {connection.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getConnectionDescription(connection)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={onNewConnection}
                className="w-full h-11"
                size="lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Connection
              </Button>
              
              <p className="text-center text-xs text-muted-foreground mt-4">
                Press <kbd className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono text-[10px]">⌘K</kbd> for command palette
              </p>
            </div>
            
            {/* Version info */}
            <p className="text-center text-xs text-muted-foreground/50 mt-6">
              QueryStudio v0.1.0
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
