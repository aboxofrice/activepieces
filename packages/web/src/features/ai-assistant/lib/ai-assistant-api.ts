import { api } from '@/lib/api';
import {
  AIAssistantChatRequest,
  AIAssistantChatResponse,
} from '@activepieces/shared';

export const aiAssistantApi = {
  chat(request: AIAssistantChatRequest): Promise<AIAssistantChatResponse> {
    return api.post<AIAssistantChatResponse>('/v1/ai-assistant/chat', request);
  },
};
