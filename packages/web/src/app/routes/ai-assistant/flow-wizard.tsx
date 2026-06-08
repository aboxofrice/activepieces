import { useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Import,
  Loader2,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { aiAssistantApi } from '@/features/ai-assistant/lib/ai-assistant-api';
import { flowsApi } from '@/features/flows/api/flows-api';
import { piecesApi } from '@/features/pieces/api/pieces-api';
import { authenticationSession } from '@/lib/authentication-session';
import { cn } from '@/lib/utils';
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import {
  AIAssistantMode,
  AIProviderName,
  FlowOperationType,
} from '@activepieces/shared';

interface WizardData {
  // Step 1: Source
  sourceSystem: string;
  sourceSystemName: string;

  // Step 2: Trigger
  triggerType: string;
  triggerDescription: string;

  // Step 3: Destination
  destinationSystem: string;
  destinationSystemName: string;

  // Step 4: Action
  actionType: string;
  actionDescription: string;

  // Step 5: Additional details
  additionalDetails: string;
}

const WIZARD_STEPS = [
  { id: 'source', title: 'Source System', description: 'Where does the data come from?' },
  { id: 'trigger', title: 'Trigger Event', description: 'What starts this flow?' },
  { id: 'destination', title: 'Destination', description: 'Where should the data go?' },
  { id: 'action', title: 'Action', description: 'What should happen?' },
  { id: 'generate', title: 'Generate Flow', description: 'Review and create' },
];

interface FlowWizardProps {
  provider: AIProviderName;
  model: string;
  onBack: () => void;
  onFlowGenerated: (flowJson: string) => void;
}

// Helper to check if a piece can be used as a trigger source
const canBeSource = (piece: PieceMetadataModelSummary): boolean => {
  return piece.triggers > 0 || piece.name === '@activepieces/piece-schedule' || piece.name === '@activepieces/piece-webhook';
};

// Helper to check if a piece can be used as an action destination
const canBeDestination = (piece: PieceMetadataModelSummary): boolean => {
  return piece.actions > 0;
};

export const FlowWizard = ({ provider, model, onBack, onFlowGenerated }: FlowWizardProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({
    sourceSystem: '',
    sourceSystemName: '',
    triggerType: '',
    triggerDescription: '',
    destinationSystem: '',
    destinationSystemName: '',
    actionType: '',
    actionDescription: '',
    additionalDetails: '',
  });
  const [generatedFlow, setGeneratedFlow] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Fetch all pieces
  const { data: pieces = [], isLoading: isLoadingPieces } = useQuery({
    queryKey: ['pieces-for-wizard'],
    queryFn: () => piecesApi.list({ includeHidden: false, includeTags: false }),
  });

  // Filter pieces for source (those with triggers)
  const sourcePieces = useMemo(() => {
    const filtered = pieces.filter(canBeSource);
    if (!sourceSearch) return filtered.slice(0, 50); // Show first 50 by default
    return filtered.filter(p =>
      p.displayName.toLowerCase().includes(sourceSearch.toLowerCase())
    );
  }, [pieces, sourceSearch]);

  // Filter pieces for destination (those with actions)
  const destPieces = useMemo(() => {
    const filtered = pieces.filter(canBeDestination);
    if (!destSearch) return filtered.slice(0, 50);
    return filtered.filter(p =>
      p.displayName.toLowerCase().includes(destSearch.toLowerCase())
    );
  }, [pieces, destSearch]);

  // Fetch triggers for selected source piece
  const { data: sourcePieceDetails, isLoading: isLoadingSourceDetails } = useQuery({
    queryKey: ['piece-details', wizardData.sourceSystem],
    queryFn: () => piecesApi.get({ name: wizardData.sourceSystem }),
    enabled: !!wizardData.sourceSystem,
  });

  // Fetch actions for selected destination piece
  const { data: destPieceDetails, isLoading: isLoadingDestDetails } = useQuery({
    queryKey: ['piece-details', wizardData.destinationSystem],
    queryFn: () => piecesApi.get({ name: wizardData.destinationSystem }),
    enabled: !!wizardData.destinationSystem,
  });

  const triggers = useMemo(() => {
    if (!sourcePieceDetails?.triggers) return [];
    return Object.entries(sourcePieceDetails.triggers).map(([key, trigger]) => ({
      value: key,
      label: trigger.displayName,
      description: trigger.description,
    }));
  }, [sourcePieceDetails]);

  const actions = useMemo(() => {
    if (!destPieceDetails?.actions) return [];
    return Object.entries(destPieceDetails.actions).map(([key, action]) => ({
      value: key,
      label: action.displayName,
      description: action.description,
    }));
  }, [destPieceDetails]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import flow mutation - defined before generateMutation so it can be called from onSuccess
  const importMutation = useMutation({
    mutationFn: async (flowJson: string) => {
      setImportError(null);

      // Parse the generated JSON
      let parsedFlow;
      try {
        parsedFlow = JSON.parse(flowJson);
      } catch (e) {
        throw new Error(`Invalid JSON format: ${e instanceof Error ? e.message : 'Parse error'}`);
      }

      // Handle both template format (with flows array) and direct import format
      const flowData = parsedFlow.flows?.[0] || parsedFlow;

      // Validate required fields
      if (!flowData.trigger) {
        throw new Error('Flow must have a trigger. The AI may have generated an incomplete flow.');
      }

      if (!flowData.trigger.settings?.pieceName) {
        throw new Error('Trigger must have a pieceName in settings.');
      }

      if (!flowData.trigger.type) {
        throw new Error('Trigger must have a type (e.g., PIECE_TRIGGER).');
      }

      // Validate action chain
      let currentAction = flowData.trigger.nextAction;
      const stepNames = new Set(['trigger']);
      while (currentAction) {
        if (!currentAction.name) {
          throw new Error('Each action must have a unique name.');
        }
        if (stepNames.has(currentAction.name)) {
          throw new Error(`Duplicate step name: ${currentAction.name}`);
        }
        stepNames.add(currentAction.name);

        if (currentAction.type === 'PIECE' && !currentAction.settings?.pieceName) {
          throw new Error(`Action "${currentAction.name}" must have a pieceName in settings.`);
        }

        // Handle branching
        if (currentAction.type === 'BRANCH') {
          // Branch validation - just check it exists, don't traverse deeply
          if (!currentAction.settings?.conditions) {
            throw new Error(`Branch "${currentAction.name}" must have conditions.`);
          }
          break; // Stop linear chain validation for branches
        }

        currentAction = currentAction.nextAction;
      }

      // Create a new flow first
      const displayName = flowData.displayName || parsedFlow.name || `${wizardData.sourceSystemName} to ${wizardData.destinationSystemName}`;
      const newFlow = await flowsApi.create({
        displayName,
        projectId: authenticationSession.getProjectId()!,
      });

      // Import the flow content
      const importedFlow = await flowsApi.update(newFlow.id, {
        type: FlowOperationType.IMPORT_FLOW,
        request: {
          displayName,
          trigger: flowData.trigger,
          schemaVersion: flowData.schemaVersion || '10',
        },
      });

      return importedFlow;
    },
    onSuccess: (flow) => {
      toast.success(t('Flow imported successfully!'));
      onFlowGenerated(generatedFlow!);
      navigate(`/flows/${flow.id}`);
    },
    onError: (error: unknown) => {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to import flow';
      setImportError(errorMsg);
    },
  });

  const generateMutation = useMutation({
    mutationFn: aiAssistantApi.chat,
    onSuccess: (response) => {
      setErrorMessage(null);
      const content = response.message.content;
      let flowJson: string | null = null;
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        flowJson = jsonMatch[1];
      } else {
        const rawJsonMatch = content.match(/\{[\s\S]*\}/);
        if (rawJsonMatch) {
          flowJson = rawJsonMatch[0];
        } else {
          flowJson = content;
        }
      }
      setGeneratedFlow(flowJson);
      // Auto-import the flow after generation
      if (flowJson) {
        importMutation.mutate(flowJson);
      }
    },
    onError: (error: unknown) => {
      // Extract error message from Axios error structure
      let message = 'Unknown error';
      const axiosError = error as { response?: { data?: { message?: string; code?: string; params?: { message?: string } }; status?: number }; message?: string };

      if (axiosError.response?.data?.message) {
        message = axiosError.response.data.message;
      } else if (axiosError.response?.data?.params?.message) {
        message = axiosError.response.data.params.message;
      } else if (axiosError.response?.data?.code) {
        message = axiosError.response.data.code;
      } else if (axiosError.message) {
        message = axiosError.message;
      }

      const status = axiosError.response?.status;

      console.error('AI Assistant error:', { message, status, error });

      if (message.includes('ENTITY_NOT_FOUND') || message.includes('not found') || status === 404) {
        setErrorMessage(t('AI provider not configured. Please configure an AI provider in Platform Settings → AI Providers.'));
      } else if (message.includes('quota') || message.includes('insufficient_quota') || message.includes('rate limit') ||
                 message.includes('credit') || message.includes('billing') || message.includes('RESOURCE_EXHAUSTED')) {
        setErrorMessage(t('AI provider quota exceeded or out of credits. Please add credits to your provider account or switch to a different provider.'));
      } else if (message.includes('API key') || message.includes('authentication') || message.includes('UNAUTHENTICATED') || status === 401 || status === 403) {
        setErrorMessage(t('Invalid API key for the selected AI provider. Please check your configuration.'));
      } else if (status === 500) {
        // For 500 errors, show a more helpful message with the actual error
        const shortMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;
        setErrorMessage(t('Server error: {message}', { message: shortMessage }));
      } else {
        setErrorMessage(t('Failed to generate flow: {message}', { message }));
      }
    },
  });

  const updateData = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setWizardData((prev) => ({ ...prev, [key]: value }));
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: // Source
        return wizardData.sourceSystem !== '';
      case 1: // Trigger
        return wizardData.triggerType !== '';
      case 2: // Destination
        return wizardData.destinationSystem !== '';
      case 3: // Action
        return wizardData.actionType !== '';
      case 4: // Generate
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = () => {
    const triggerLabel = triggers.find(tr => tr.value === wizardData.triggerType)?.label || wizardData.triggerType;
    const actionLabel = actions.find(a => a.value === wizardData.actionType)?.label || wizardData.actionType;

    // Extract trigger props for context
    const selectedTrigger = sourcePieceDetails?.triggers?.[wizardData.triggerType];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const triggerProps = selectedTrigger?.props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? Object.entries(selectedTrigger.props).map(([key, prop]: [string, any]) => ({
          name: key,
          displayName: prop.displayName,
          required: prop.required,
          type: prop.type,
        }))
      : [];

    // Extract action props for context
    const selectedAction = destPieceDetails?.actions?.[wizardData.actionType];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionProps = selectedAction?.props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? Object.entries(selectedAction.props).map(([key, prop]: [string, any]) => ({
          name: key,
          displayName: prop.displayName,
          required: prop.required,
          type: prop.type,
        }))
      : [];

    // Build piece metadata for AI context
    const pieceMetadata = `<available-pieces>
<source-piece name="${wizardData.sourceSystem}" version="${sourcePieceDetails?.version || '~0.5.0'}">
  <trigger name="${wizardData.triggerType}" displayName="${triggerLabel}">
    <props>${JSON.stringify(triggerProps)}</props>
  </trigger>
</source-piece>
<destination-piece name="${wizardData.destinationSystem}" version="${destPieceDetails?.version || '~0.5.0'}">
  <action name="${wizardData.actionType}" displayName="${actionLabel}">
    <props>${JSON.stringify(actionProps)}</props>
  </action>
</destination-piece>
</available-pieces>`;

    const prompt = `${pieceMetadata}

Generate an Activepieces flow JSON:

**Source:** ${wizardData.sourceSystemName} (${wizardData.sourceSystem})
**Trigger:** ${triggerLabel} (${wizardData.triggerType})
${wizardData.triggerDescription ? `**Details:** ${wizardData.triggerDescription}` : ''}

**Destination:** ${wizardData.destinationSystemName} (${wizardData.destinationSystem})
**Action:** ${actionLabel} (${wizardData.actionType})
${wizardData.actionDescription ? `**Details:** ${wizardData.actionDescription}` : ''}

${wizardData.additionalDetails ? `**Additional:** ${wizardData.additionalDetails}` : ''}

Generate complete, import-ready JSON with field mappings.`;

    generateMutation.mutate({
      projectId: authenticationSession.getProjectId()!,
      provider,
      model,
      mode: AIAssistantMode.CREATE,
      messages: [{ role: 'user', content: prompt }],
    });
  };

  const handleCopy = async () => {
    if (generatedFlow) {
      await navigator.clipboard.writeText(generatedFlow);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (generatedFlow) {
      const blob = new Blob([generatedFlow], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activepieces-flow.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = () => {
    if (generatedFlow) {
      importMutation.mutate(generatedFlow);
    }
  };

  const renderPieceGrid = (
    pieceList: PieceMetadataModelSummary[],
    selectedValue: string,
    onSelect: (piece: PieceMetadataModelSummary) => void,
    search: string,
    onSearchChange: (value: string) => void,
    isLoading: boolean
  ) => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('Search connectors...')}
          className="pl-9"
        />
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid max-h-[400px] grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 md:grid-cols-4">
          {pieceList.map((piece) => (
            <button
              key={piece.name}
              onClick={() => onSelect(piece)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all hover:border-primary',
                selectedValue === piece.name && 'border-primary bg-primary/5'
              )}
            >
              {piece.logoUrl ? (
                <img src={piece.logoUrl} alt={piece.displayName} className="h-8 w-8" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs">
                  {piece.displayName.charAt(0)}
                </div>
              )}
              <span className="line-clamp-2 text-xs font-medium">{piece.displayName}</span>
            </button>
          ))}
          {pieceList.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
              {t('No connectors found')}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Source System
        return (
          <div className="space-y-4">
            <Label>{t('Select the source system')}</Label>
            {renderPieceGrid(
              sourcePieces,
              wizardData.sourceSystem,
              (piece) => {
                updateData('sourceSystem', piece.name);
                updateData('sourceSystemName', piece.displayName);
                updateData('triggerType', ''); // Reset trigger when source changes
              },
              sourceSearch,
              setSourceSearch,
              isLoadingPieces
            )}
          </div>
        );

      case 1: // Trigger
        return (
          <div className="space-y-4">
            <Label>{t('What event should trigger this flow?')}</Label>
            {isLoadingSourceDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-[350px] space-y-2 overflow-auto">
                {triggers.map((trigger) => (
                  <button
                    key={trigger.value}
                    onClick={() => updateData('triggerType', trigger.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary',
                      wizardData.triggerType === trigger.value && 'border-primary bg-primary/5'
                    )}
                  >
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{trigger.label}</div>
                      {trigger.description && (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {trigger.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                {triggers.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('No triggers available for this piece')}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4">
              <Label>{t('Additional trigger details (optional)')}</Label>
              <Textarea
                value={wizardData.triggerDescription}
                onChange={(e) => updateData('triggerDescription', e.target.value)}
                placeholder={t('e.g., Only for premium customers, specific record types, etc.')}
                className="mt-2"
                rows={2}
              />
            </div>
          </div>
        );

      case 2: // Destination
        return (
          <div className="space-y-4">
            <Label>{t('Select the destination system')}</Label>
            {renderPieceGrid(
              destPieces,
              wizardData.destinationSystem,
              (piece) => {
                updateData('destinationSystem', piece.name);
                updateData('destinationSystemName', piece.displayName);
                updateData('actionType', ''); // Reset action when dest changes
              },
              destSearch,
              setDestSearch,
              isLoadingPieces
            )}
          </div>
        );

      case 3: // Action
        return (
          <div className="space-y-4">
            <Label>{t('What action should be performed?')}</Label>
            {isLoadingDestDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-[350px] space-y-2 overflow-auto">
                {actions.map((action) => (
                  <button
                    key={action.value}
                    onClick={() => updateData('actionType', action.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary',
                      wizardData.actionType === action.value && 'border-primary bg-primary/5'
                    )}
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{action.label}</div>
                      {action.description && (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {action.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                {actions.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('No actions available for this piece')}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4">
              <Label>{t('Additional action details (optional)')}</Label>
              <Textarea
                value={wizardData.actionDescription}
                onChange={(e) => updateData('actionDescription', e.target.value)}
                placeholder={t('e.g., Create as Contact record, set status to Active, etc.')}
                className="mt-2"
                rows={2}
              />
            </div>
          </div>
        );

      case 4: { // Generate
        const triggerLabel = triggers.find(tr => tr.value === wizardData.triggerType)?.label || wizardData.triggerType;
        const actionLabel = actions.find(a => a.value === wizardData.actionType)?.label || wizardData.actionType;

        return (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h3 className="mb-3 font-medium">{t('Flow Summary')}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Source:')}</span>
                  <span className="font-medium">{wizardData.sourceSystemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Trigger:')}</span>
                  <span className="font-medium">{triggerLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Destination:')}</span>
                  <span className="font-medium">{wizardData.destinationSystemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Action:')}</span>
                  <span className="font-medium">{actionLabel}</span>
                </div>
              </div>
            </div>

            <div>
              <Label>{t('Additional details for AI (optional)')}</Label>
              <Textarea
                value={wizardData.additionalDetails}
                onChange={(e) => updateData('additionalDetails', e.target.value)}
                placeholder={t('e.g., Field mappings, conditions, error handling preferences...')}
                className="mt-2"
                rows={3}
              />
            </div>

            {!generatedFlow && (
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full"
                size="lg"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('Generating Flow...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('Generate Flow with AI')}
                  </>
                )}
              </Button>
            )}

            {generateMutation.isError && errorMessage && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            {generatedFlow && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('Generated Flow JSON')}</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : (
                        <Copy className="mr-1 h-3 w-3" />
                      )}
                      {copied ? t('Copied!') : t('Copy')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="mr-1 h-3 w-3" />
                      {t('Download')}
                    </Button>
                  </div>
                </div>
                <pre className="max-h-[300px] overflow-auto rounded-lg bg-muted p-4 text-xs">
                  {generatedFlow}
                </pre>

                {importError && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                    {t('Import failed: {error}', { error: importError })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                    className="flex-1"
                    size="lg"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('Importing...')}
                      </>
                    ) : (
                      <>
                        <Import className="mr-2 h-4 w-4" />
                        {t('Import Flow')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setGeneratedFlow(null);
                      setImportError(null);
                      handleGenerate();
                    }}
                    variant="outline"
                    disabled={importMutation.isPending}
                  >
                    {t('Regenerate')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('Back')}
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">{t('Flow Creation Wizard')}</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('Step {current} of {total}', { current: currentStep + 1, total: WIZARD_STEPS.length })}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'flex items-center',
                index < WIZARD_STEPS.length - 1 && 'flex-1'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  index < currentStep && 'bg-primary text-primary-foreground',
                  index === currentStep && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
                  index > currentStep && 'bg-muted text-muted-foreground'
                )}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{WIZARD_STEPS[currentStep].title}</h2>
            <p className="text-muted-foreground">{WIZARD_STEPS[currentStep].description}</p>
          </div>
          {renderStepContent()}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <div className="mx-auto flex max-w-2xl justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('Previous')}
          </Button>
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t('Next')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
