import { useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { Bot, MessageSquare, PenLine, Send, Settings2, Sparkles, Wand2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { aiAssistantApi } from '@/features/ai-assistant/lib/ai-assistant-api';
import { piecesApi } from '@/features/pieces/lib/pieces-api';
import { aiProviderApi } from '@/features/platform-admin/lib/ai-provider-api';
import { cn } from '@/lib/utils';
import {
  AIAssistantMode,
  AIProviderModel,
  AIProviderModelType,
  AIProviderName,
  AIProviderWithoutSensitiveData,
} from '@activepieces/shared';

import { FlowWizard } from './flow-wizard';

type AssistantMode = 'select' | 'wizard' | 'chat' | 'review';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ModeSelectionCard = ({
  icon: Icon,
  title,
  description,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Card
    className={cn(
      'transition-all',
      disabled
        ? 'cursor-not-allowed opacity-50'
        : 'cursor-pointer hover:border-primary hover:shadow-md',
    )}
    onClick={disabled ? undefined : onClick}
  >
    <CardHeader className="pb-2">
      <div className="flex items-center gap-3">
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          disabled ? 'bg-muted' : 'bg-primary/10',
        )}>
          <Icon className={cn('h-5 w-5', disabled ? 'text-muted-foreground' : 'text-primary')} />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-sm">{description}</CardDescription>
    </CardContent>
  </Card>
);

const ChatMessage = ({ message }: { message: Message }) => (
  <div
    className={cn(
      'flex w-full',
      message.role === 'user' ? 'justify-end' : 'justify-start',
    )}
  >
    <div
      className={cn(
        'max-w-[80%] rounded-lg px-4 py-2',
        message.role === 'user'
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted',
      )}
    >
      {message.role === 'assistant' && (
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3 w-3" />
          {t('AI Assistant')}
        </div>
      )}
      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
    </div>
  </div>
);

const ProviderSelector = ({
  providers,
  selectedProvider,
  onProviderChange,
  models,
  selectedModel,
  onModelChange,
  isLoadingModels,
}: {
  providers: AIProviderWithoutSensitiveData[];
  selectedProvider: string | null;
  onProviderChange: (provider: string) => void;
  models: AIProviderModel[];
  selectedModel: string | null;
  onModelChange: (model: string) => void;
  isLoadingModels: boolean;
}) => {
  const configuredProviders = providers.filter((p) => p.configured);
  const textModels = models.filter((m) => m.type === AIProviderModelType.TEXT);

  if (configuredProviders.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <Settings2 className="h-4 w-4" />
        <span>
          {t('No AI providers configured.')}{' '}
          <a href="/admin/setup/ai" className="text-primary hover:underline">
            {t('Configure in Admin Settings')}
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Select value={selectedProvider ?? ''} onValueChange={onProviderChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('Select Provider')} />
        </SelectTrigger>
        <SelectContent>
          {configuredProviders.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedModel ?? ''}
        onValueChange={onModelChange}
        disabled={!selectedProvider || isLoadingModels}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue
            placeholder={
              isLoadingModels ? t('Loading models...') : t('Select Model')
            }
          />
        </SelectTrigger>
        <SelectContent>
          {textModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const AIAssistantPage = () => {
  const [mode, setMode] = useState<AssistantMode>('select');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState<number | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch pieces for @ mention autocomplete
  const { data: pieces = [] } = useQuery({
    queryKey: ['pieces-for-mention'],
    queryFn: () => piecesApi.list({ includeHidden: false, includeTags: false }),
  });

  // Filter pieces based on mention search
  const filteredPieces = mentionSearch
    ? pieces.filter(
        (p) =>
          p.displayName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
          p.name.toLowerCase().includes(mentionSearch.toLowerCase()),
      ).slice(0, 8)
    : pieces.slice(0, 8);

  // Fetch AI providers
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => aiProviderApi.list(),
  });

  // Fetch models for selected provider
  const { data: models = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ['ai-provider-models', selectedProvider],
    queryFn: () => aiProviderApi.listModels(selectedProvider!),
    enabled: !!selectedProvider,
  });

  // Auto-select first configured provider
  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      const configuredProvider = providers.find((p) => p.configured);
      if (configuredProvider) {
        setSelectedProvider(configuredProvider.id);
      }
    }
  }, [providers, selectedProvider]);

  // Auto-select first text model
  useEffect(() => {
    if (selectedProvider && models.length > 0 && !selectedModel) {
      const textModel = models.find((m) => m.type === AIProviderModelType.TEXT);
      if (textModel) {
        setSelectedModel(textModel.id);
      }
    }
  }, [models, selectedProvider, selectedModel]);

  // Reset model when provider changes
  useEffect(() => {
    setSelectedModel(null);
  }, [selectedProvider]);

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleModeSelect = (selectedMode: 'wizard' | 'chat' | 'review') => {
    setMode(selectedMode);
    if (selectedMode === 'wizard') {
      // Wizard mode doesn't need messages
      return;
    }
    const welcomeMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        selectedMode === 'chat'
          ? t(
              "I'm ready to help you create a new integration flow. Let's start by understanding what you want to build.\n\nPlease describe the automation you'd like to create. For example:\n- \"Sync contacts from HubSpot to our loan system when a deal closes\"\n- \"When a webhook is received, create a record in Encompass\"\n- \"Process loan applications and update the CRM with status\"\n\nOr, if you'd like me to guide you through it, just say \"help me get started\" and I'll ask you the right questions.",
            )
          : t(
              "I'm ready to help you review or modify an existing flow.\n\nYou can:\n1. **Paste a flow JSON** for me to analyze and identify issues\n2. **Describe changes** you want to make to an existing flow\n3. **Ask questions** about how a flow works\n\nWhat would you like to do?",
            ),
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: aiAssistantApi.chat,
    onSuccess: (response) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message.content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error: unknown) => {
      // Extract detailed error message from Axios error
      const axiosError = error as {
        response?: {
          data?: { message?: string; code?: string; params?: { message?: string } };
          status?: number
        };
        message?: string
      };

      let errorContent = '';
      const status = axiosError.response?.status;
      const serverMessage = axiosError.response?.data?.message
        || axiosError.response?.data?.params?.message
        || axiosError.message
        || 'Unknown error';

      // Check for quota/credit errors
      if (serverMessage.includes('quota') || serverMessage.includes('insufficient_quota') ||
          serverMessage.includes('credit') || serverMessage.includes('billing') ||
          serverMessage.includes('rate limit') || serverMessage.includes('RESOURCE_EXHAUSTED')) {
        errorContent = t('**API Quota Exceeded**\n\nYour AI provider has run out of credits or exceeded rate limits.\n\n**Solutions:**\n1. Add credits to your provider account\n2. Wait a few minutes if rate limited\n3. Switch to a different AI provider\n\nProvider error: {message}', { message: serverMessage.substring(0, 200) });
      } else if (serverMessage.includes('API key') || serverMessage.includes('authentication') ||
                 serverMessage.includes('UNAUTHENTICATED') || status === 401 || status === 403) {
        errorContent = t('**Authentication Error**\n\nThe API key for your AI provider is invalid or expired.\n\nPlease check your AI provider configuration in Settings → AI Providers.');
      } else if (serverMessage.includes('ENTITY_NOT_FOUND') || serverMessage.includes('not found') || status === 404) {
        errorContent = t('**AI Provider Not Found**\n\nNo AI provider is configured for this platform.\n\nPlease configure an AI provider in Settings → AI Providers.');
      } else if (status === 500) {
        errorContent = t('**Server Error**\n\nAn error occurred while processing your request.\n\nDetails: {message}', { message: serverMessage.substring(0, 300) });
      } else {
        errorContent = t('**Error**\n\n{message}', { message: serverMessage });
      }

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !selectedProvider || !selectedModel) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Convert messages to API format
    // Skip the first message (welcome message) as it's a static UI message, not AI context
    const apiMessages = [...messages, userMessage]
      .slice(1) // Skip welcome message
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      await chatMutation.mutateAsync({
        provider: selectedProvider as AIProviderName,
        model: selectedModel,
        mode: mode === 'chat' ? AIAssistantMode.CREATE : AIAssistantMode.REVIEW,
        messages: apiMessages,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change and detect @ mentions
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart;
      setInput(value);

      // Find the @ symbol before cursor
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        // Check if @ is at start or preceded by whitespace
        const charBeforeAt = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' ';
        if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
          const searchText = textBeforeCursor.slice(lastAtIndex + 1);
          // Only open if there's no space after @
          if (!searchText.includes(' ') && !searchText.includes('\n')) {
            setMentionOpen(true);
            setMentionSearch(searchText);
            setMentionStartIndex(lastAtIndex);
            setMentionCursorPos(cursorPos); // Store cursor position for later use
            setMentionSelectedIndex(0); // Reset selection when search changes
            return;
          }
        }
      }

      // Close mention popover
      setMentionOpen(false);
      setMentionSearch('');
      setMentionStartIndex(null);
    },
    [],
  );

  // Handle piece selection from mention popover
  const handlePieceSelect = useCallback(
    (pieceName: string) => {
      if (mentionStartIndex === null || mentionCursorPos === null) return;

      // Get text before the @ symbol (not including the @)
      const beforeMention = input.slice(0, mentionStartIndex);

      // Get text after the cursor position when @ was typed (this removes @searchText)
      const afterMention = input.slice(mentionCursorPos);

      // Replace "@searchText" with the full piece name (which already has @ in scoped names)
      const newValue = `${beforeMention}${pieceName} ${afterMention}`;
      setInput(newValue);

      // Close popover
      setMentionOpen(false);
      setMentionSearch('');
      setMentionStartIndex(null);
      setMentionCursorPos(null);
      setMentionSelectedIndex(0);

      // Focus textarea and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + pieceName.length + 1; // +1 for space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [input, mentionStartIndex, mentionCursorPos],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention popover keyboard navigation
    if (mentionOpen && filteredPieces.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) =>
          prev < filteredPieces.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredPieces.length - 1,
        );
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        handlePieceSelect(filteredPieces[mentionSelectedIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        setMentionSearch('');
        setMentionStartIndex(null);
        setMentionCursorPos(null);
        setMentionSelectedIndex(0);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleBack = () => {
    setMode('select');
    setMessages([]);
    setInput('');
  };

  if (mode === 'select') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold">{t('AI Flow Assistant')}</h1>
          <p className="mt-2 text-muted-foreground">
            {t('Build and modify integration flows with AI assistance')}
          </p>
        </div>

        {/* Provider Selection */}
        <div className="mb-8 flex justify-center">
          {isLoadingProviders ? (
            <div className="text-sm text-muted-foreground">
              {t('Loading AI providers...')}
            </div>
          ) : (
            <ProviderSelector
              providers={providers}
              selectedProvider={selectedProvider}
              onProviderChange={setSelectedProvider}
              models={models}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              isLoadingModels={isLoadingModels}
            />
          )}
        </div>

        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-3">
          <ModeSelectionCard
            icon={Wand2}
            title={t('Guided Wizard')}
            description={t(
              'Step-by-step wizard to create a flow by selecting systems and actions.',
            )}
            onClick={() => handleModeSelect('wizard')}
            disabled={!selectedProvider || !selectedModel}
          />
          <ModeSelectionCard
            icon={MessageSquare}
            title={t('Chat with AI')}
            description={t(
              'Describe what you want in natural language and AI will generate the flow.',
            )}
            onClick={() => handleModeSelect('chat')}
            disabled={!selectedProvider || !selectedModel}
          />
          <ModeSelectionCard
            icon={PenLine}
            title={t('Review & Edit')}
            description={t(
              'Paste an existing flow JSON to analyze, find issues, or modify.',
            )}
            onClick={() => handleModeSelect('review')}
            disabled={!selectedProvider || !selectedModel}
          />
        </div>

        {(!selectedProvider || !selectedModel) && providers.filter(p => p.configured).length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t('Please select an AI provider and model above to continue')}
          </p>
        )}
      </div>
    );
  }

  // Wizard mode
  if (mode === 'wizard') {
    return (
      <FlowWizard
        provider={selectedProvider as AIProviderName}
        model={selectedModel!}
        onBack={handleBack}
        onFlowGenerated={(flowJson) => {
          // Could navigate to import or show success
          console.log('Flow generated:', flowJson);
        }}
      />
    );
  }

  // Chat/Review mode
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            {t('Back')}
          </Button>
          <div className="flex items-center gap-2">
            {mode === 'chat' ? (
              <MessageSquare className="h-4 w-4 text-primary" />
            ) : (
              <PenLine className="h-4 w-4 text-primary" />
            )}
            <span className="font-medium">
              {mode === 'chat'
                ? t('Chat with AI')
                : t('Review & Edit Flow')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProviderSelector
            providers={providers}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            isLoadingModels={isLoadingModels}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([]);
              handleModeSelect(mode as 'chat' | 'review');
            }}
          >
            {t('Clear Chat')}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" viewPortRef={scrollViewportRef}>
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4 animate-pulse" />
              <span className="text-sm">{t('Thinking...')}</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
            <PopoverAnchor asChild>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'chat'
                    ? t('Describe the automation you want to build... (Type @ to mention a piece)')
                    : t('Paste a flow JSON or describe the changes you want... (Type @ to mention a piece)')
                }
                className="min-h-[60px] resize-none"
                disabled={isLoading || !selectedProvider || !selectedModel}
              />
            </PopoverAnchor>
            <PopoverContent
              className="w-[300px] p-0"
              align="start"
              side="top"
              sideOffset={5}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>{t('No pieces found')}</CommandEmpty>
                  <CommandGroup heading={t('Pieces')}>
                    {filteredPieces.map((piece, index) => (
                      <CommandItem
                        key={piece.name}
                        value={piece.name}
                        onSelect={() => handlePieceSelect(piece.name)}
                        className={cn(
                          'flex items-center gap-2',
                          index === mentionSelectedIndex && 'bg-accent',
                        )}
                        onMouseEnter={() => setMentionSelectedIndex(index)}
                      >
                        {piece.logoUrl && (
                          <img
                            src={piece.logoUrl}
                            alt=""
                            className="h-5 w-5 rounded"
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm">{piece.displayName}</span>
                          <span className="text-xs text-muted-foreground">
                            {piece.name}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading || !selectedProvider || !selectedModel}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
          {!selectedProvider || !selectedModel
            ? t('Please select an AI provider and model to continue')
            : t('Press Enter to send, Shift+Enter for new line')}
        </p>
      </div>
    </div>
  );
};

export default AIAssistantPage;
