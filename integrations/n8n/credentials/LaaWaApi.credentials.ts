import type { INodeProperties, ICredentialType } from 'n8n-workflow';

export class LaaWaApi implements ICredentialType {
  name = 'laawaApi';
  displayName = 'LaaWa API';
  documentationUrl = 'https://github.com/laavastudios/LaaWa';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:3000/api/v1',
      placeholder: 'https://your-laawa.example.com/api/v1',
      description: 'The v1 API base URL of your self-hosted LaaWa instance.',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'A LaaWa API key with the scopes required by the selected operation.',
    },
  ];
}
