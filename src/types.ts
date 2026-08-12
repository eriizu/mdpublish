export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface Page {
  sourcePath: string;
  relativePath: string;
  sourceDirectory: string;
  route: string;
  title: string;
  order: number;
  showInNavigation: boolean;
  markdown: string;
}

export interface VaultAsset {
  sourcePath: string;
  relativePath: string;
}

export interface Vault {
  root: string;
  pages: Page[];
  assets: VaultAsset[];
  pageByPath: Map<string, Page>;
  pagesByBasename: Map<string, Page[]>;
  assetByPath: Map<string, VaultAsset>;
  assetsByBasename: Map<string, VaultAsset[]>;
}

export interface NavigationConfigEntry {
  path: string;
  label?: string;
}

export interface SiteConfig {
  navigation?: NavigationConfigEntry[];
  welcome?: string;
  title?: string;
}

export type NavigationItem =
  | {
      type: "page";
      page: Page;
      label: string;
    }
  | {
      type: "folder";
      label: string;
      children: NavigationItem[];
    };

export interface BuildOptions {
  inputDir: string;
  outputDir: string;
  title?: string;
  basePath?: string;
  liveReload?: boolean;
}

export interface BuildResult {
  pages: number;
  assets: number;
  warnings: string[];
  outputDir: string;
}
