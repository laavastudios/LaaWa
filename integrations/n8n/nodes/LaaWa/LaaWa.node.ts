import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class LaaWa implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'LaaWa',
    name: 'laawa',
    icon: 'file:laawa.svg',
    group: ['transform'],
    version: 1,
    description: 'Automate self-hosted LaaWa messaging through the v1 API.',
    defaults: { name: 'LaaWa' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'laawaApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        options: [
          { name: 'Message', value: 'message' },
          { name: 'Engine', value: 'engine' },
          { name: 'Health', value: 'health' },
        ],
        default: 'message',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: { show: { resource: ['message'] } },
        options: [
          { name: 'Send', value: 'send' },
          { name: 'List Messages', value: 'list' },
        ],
        default: 'send',
      },
      {
        displayName: 'Account ID',
        name: 'accountId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['message'] } },
      },
      {
        displayName: 'Chat ID',
        name: 'chatId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['message'] } },
      },
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        displayOptions: { show: { resource: ['message'], operation: ['send'] } },
      },
      {
        displayName: 'Input Field',
        name: 'inputField',
        type: 'string',
        default: 'text',
        description: 'Optional item field to use as the message text when Text is empty.',
        displayOptions: { show: { resource: ['message'], operation: ['send'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials('laawaApi');
    const baseUrl = String(credentials.baseUrl || '').replace(/\/$/, '');
    const apiKey = String(credentials.apiKey || '');
    if (!baseUrl || !apiKey) throw new NodeOperationError(this.getNode(), 'LaaWa API credentials are incomplete.');

    const output: INodeExecutionData[] = [];
    for (let index = 0; index < items.length; index += 1) {
      try {
        const resource = this.getNodeParameter('resource', index) as string;
        let response: unknown;
        if (resource === 'health') {
          response = await this.helpers.httpRequest({
            method: 'GET',
            url: `${baseUrl}/health`,
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
            json: true,
          });
        } else if (resource === 'engine') {
          response = await this.helpers.httpRequest({
            method: 'GET',
            url: `${baseUrl}/engines`,
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
            json: true,
          });
        } else {
          const operation = this.getNodeParameter('operation', index) as string;
          const accountId = String(this.getNodeParameter('accountId', index));
          const chatId = String(this.getNodeParameter('chatId', index));
          if (operation === 'list') {
            const query = new URLSearchParams({ accountId, chatId });
            response = await this.helpers.httpRequest({
              method: 'GET',
              url: `${baseUrl}/messages?${query.toString()}`,
              headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
              json: true,
            });
          } else {
            const text = String(this.getNodeParameter('text', index) || '');
            const inputField = String(this.getNodeParameter('inputField', index) || 'text');
            const fallback = items[index].json[inputField];
            const body = { action: 'send', accountId, chatId, text: text || (typeof fallback === 'string' ? fallback : '') };
            if (!body.text) throw new NodeOperationError(this.getNode(), 'A message text is required.', { itemIndex: index });
            response = await this.helpers.httpRequest({
              method: 'POST',
              url: `${baseUrl}/messages`,
              headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
              body,
              json: true,
            });
          }
        }
        output.push({ json: response as Record<string, unknown> });
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: error instanceof Error ? error.message : String(error) } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error instanceof Error ? error.message : String(error), { itemIndex: index });
      }
    }
    return [output];
  }
}
