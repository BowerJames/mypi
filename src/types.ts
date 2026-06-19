export interface Profile {
	extensions?: string[];
	skills?: string[];
	prompts?: string[];
	cmd: string;
}

export interface Config {
	default: string;
	profiles: Record<string, Profile>;
}
