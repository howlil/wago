export type ApiLanguage = "en" | "id";
export type ApiMethod = "GET" | "POST";
export type ApiAuth = "public" | "api-key" | "first-run";
export type ApiGroup = "system" | "app" | "whatsapp" | "recipients" | "messages" | "audit";
export type ApiFieldLocation = "path" | "query" | "header" | "body";
export type ApiInputKind = "text" | "textarea" | "select";

export type ApiField = {
  key: string;
  wireName?: string;
  location: ApiFieldLocation;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  input?: ApiInputKind;
  options?: string[];
  label: Record<ApiLanguage, string>;
  description: Record<ApiLanguage, string>;
};

export type ApiEndpoint = {
  id: string;
  group: ApiGroup;
  method: ApiMethod;
  path: string;
  auth: ApiAuth;
  title: Record<ApiLanguage, string>;
  description: Record<ApiLanguage, string>;
  fields: ApiField[];
  liveMode: "safe" | "confirm";
  danger?: "normal" | "high";
};
