import { PieceAuth, Property } from '@activepieces/pieces-framework';

export const symxchangeAuth = PieceAuth.CustomAuth({
    description: `Connect to a Jack Henry Symitar SymXchange server.

1. **Base URL** — the SymXchange root your institution exposes, e.g. \`http://symitar-host:8087/SymXchange\`. Service paths like \`/account\` or \`/transactions\` are appended automatically.
2. **Device Type / Device Number** — the device identity registered for your integration in the SymXchange device configuration.
3. **Credentials** — provide either an **Administrative Password** (most server-to-server integrations) or a **User Number + User Password**. The administrative password wins when both are set.`,
    required: true,
    props: {
        baseUrl: Property.ShortText({
            displayName: 'Base URL',
            description: 'SymXchange root URL, without a trailing service segment.',
            required: true,
        }),
        deviceType: Property.ShortText({
            displayName: 'Device Type',
            description: 'Registered device type, e.g. SYMXCHANGE.',
            required: true,
        }),
        deviceNumber: Property.Number({
            displayName: 'Device Number',
            description: 'Registered device number for the device type.',
            required: true,
        }),
        adminPassword: PieceAuth.SecretText({
            displayName: 'Administrative Password',
            description: 'Password for AdministrativeCredentials. Leave empty when using user number credentials.',
            required: false,
        }),
        userNumber: Property.Number({
            displayName: 'User Number',
            description: 'Symitar user number (0-9999) for UserNumberCredentials.',
            required: false,
        }),
        userPassword: PieceAuth.SecretText({
            displayName: 'User Password',
            description: 'Password for the user number above.',
            required: false,
        }),
    },
});
