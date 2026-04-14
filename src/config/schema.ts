export interface Profile {
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  cmd: string;
}

export interface MypiConfig {
  default: string;
  profiles: Record<string, Profile>;
}

export interface ConfigValidationError {
  path: string;
  message: string;
}
