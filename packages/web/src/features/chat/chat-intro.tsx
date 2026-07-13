import { ChatUIResponse } from '@activepieces/shared';
import React from 'react';

import { Button } from '@/components/ui/button';

interface ChatIntroProps {
  chatUI: ChatUIResponse | null | undefined;
  botName: string;
  onSuggestionClick?: (suggestion: string) => void;
}

export function ChatIntro({
  chatUI,
  botName,
  onSuggestionClick,
}: ChatIntroProps) {
  const welcomeMessage = chatUI?.props.welcomeMessage;
  const suggestedTopics = (chatUI?.props.suggestedTopics ?? []).filter(
    (topic) => topic.trim().length > 0,
  );

  return (
    <div className="flex items-center justify-center py-8 px-4">
      <div className="flex flex-col items-center gap-1 max-w-xl">
        <div className="flex items-center justify-center p-3 rounded-full">
          <img
            src={chatUI?.platformLogoUrl}
            alt="Bot Avatar"
            className="w-10 h-10"
          />
        </div>
        <div className="flex items-center gap-1 justify-center font-bold">
          <p className="animate-typing overflow-hidden whitespace-nowrap pr-1 hidden lg:block lg:text-xl text-foreground leading-8">
            Hi! I&apos;m {botName} 👋 How can I help you today?
          </p>
          <p className="animate-typing-sm overflow-hidden whitespace-nowrap pr-1 lg:hidden text-xl text-foreground leading-8">
            Hi! I&apos;m {botName} 👋
          </p>
          <span className="w-4 h-4 rounded-full bg-foreground animate-[fade_0.15s_ease-out_forwards_0.7s_reverse]" />
        </div>
        {welcomeMessage && (
          <p className="text-muted-foreground text-center whitespace-pre-line pt-2">
            {welcomeMessage}
          </p>
        )}
        {suggestedTopics.length > 0 && (
          <div className="flex flex-col items-center gap-2 pt-4 w-full">
            {suggestedTopics.map((topic) => (
              <Button
                key={topic}
                variant="outline"
                className="rounded-full w-full max-w-sm whitespace-normal h-auto py-2"
                onClick={() => onSuggestionClick?.(topic)}
              >
                {topic}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
