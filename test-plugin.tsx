/* @plugin {
  "type": "hello-world",
  "displayName": "Hello World",
  "description": "A simple test plugin to verify the plugin import system works",
  "author": "Test User",
  "version": "1.0.0"
} */

import { useState } from "react";
import { Smile, PartyPopper, RefreshCw } from "lucide-react";
import type { TabContentProps } from "@/lib/tab-sdk";

// This is a test plugin component
// Import this file via Settings > Plugins > Add Plugin > Import File

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  const [greeting, setGreeting] = useState("Hello, World!");
  const [clickCount, setClickCount] = useState(0);

  const greetings = [
    "Hello, World!",
    "Hola, Mundo!",
    "Bonjour, le Monde!",
    "Hallo, Welt!",
    "Ciao, Mondo!",
    "こんにちは世界!",
    "你好，世界！",
    "Olá, Mundo!",
    "Привет, мир!",
    "مرحبا بالعالم!",
  ];

  const randomGreeting = () => {
    const newGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setGreeting(newGreeting);
    setClickCount((c) => c + 1);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-background p-8">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <PartyPopper className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Greeting */}
        <h1 className="text-4xl font-bold text-foreground">{greeting}</h1>

        {/* Description */}
        <p className="text-muted-foreground">
          This is a test plugin imported via the Plugin System.
          Click the button below to see a random greeting!
        </p>

        {/* Button */}
        <button
          onClick={randomGreeting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Random Greeting
        </button>

        {/* Click counter */}
        <p className="text-sm text-muted-foreground">
          Clicked {clickCount} time{clickCount !== 1 ? "s" : ""}
        </p>

        {/* Tab Info */}
        <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4 text-left text-sm">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Smile className="h-4 w-4" />
            Tab Context
          </h3>
          <div className="space-y-1 font-mono text-xs text-muted-foreground">
            <div>Tab ID: {tabId}</div>
            <div>Pane ID: {paneId}</div>
            <div>Connection ID: {connectionId}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Component;
