// Managed MySQL services (Azure Database for MySQL, TiDB Cloud, Aiven...)
// refuse unencrypted connections, so the backend must be able to speak TLS to
// them. It stays OFF unless asked for, because a local MySQL or a private
// network database (Railway, docker-compose) doesn't need it.
//
//   DB_SSL=true                        turn TLS on
//   DB_SSL_CA=<PEM text>               trust this CA (inline PEM, "\n" allowed)
//   DB_SSL_CA_BASE64=<base64 of PEM>   same, easier to paste into an env UI
//   DB_SSL_REJECT_UNAUTHORIZED=false   skip certificate verification — only for
//                                      a provider using a self-signed cert
//
// With no CA given, Node's built-in list of public CAs is used, which already
// covers Azure (DigiCert). Verification is on by default.
export interface DbSslOptions {
  rejectUnauthorized: boolean;
  ca?: string;
}

const TRUE = new Set(['1', 'true', 'yes', 'on', 'require', 'required']);

export function getDbSslOptions(env: NodeJS.ProcessEnv = process.env): DbSslOptions | undefined {
  if (!TRUE.has((env.DB_SSL ?? '').trim().toLowerCase())) return undefined;

  const options: DbSslOptions = {
    rejectUnauthorized: (env.DB_SSL_REJECT_UNAUTHORIZED ?? '').trim().toLowerCase() !== 'false',
  };
  const caBase64 = env.DB_SSL_CA_BASE64?.trim();
  const caInline = env.DB_SSL_CA?.trim();
  if (caBase64) {
    options.ca = Buffer.from(caBase64, 'base64').toString('utf8');
  } else if (caInline) {
    options.ca = caInline.replace(/\\n/g, '\n');
  }
  return options;
}
