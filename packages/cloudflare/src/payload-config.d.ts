declare module "@payload-config" {
  const config: Promise<import("payload").SanitizedConfig>;
  export default config;
}
