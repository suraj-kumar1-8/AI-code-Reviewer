import type { ReactNode } from 'react';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueCategory = 'security' | 'bugs' | 'performance' | 'quality';

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio?: string;
  location?: string;
  public_repos: number;
  total_private_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  owner_avatar?: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  visibility: 'public' | 'private';
  is_private: boolean;
  updated_at: string;
  html_url: string;
  default_branch: string;
  open_issues_count: number;
}

export interface CodeIssue {
  id: string;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
  filePath: string;
  lineNumber: number;
  description: string;
  recommendation: string;
  codeSnippet?: string;
  fixedCodeSnippet?: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  language: string;
  stars: number;
  healthScore: number;
  lastAnalyzed: string;
  issueCounts: {
    security: number;
    bugs: number;
    performance: number;
    quality: number;
  };
}

export interface MetricItem {
  value: string;
  label: string;
  description?: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface StepItem {
  step: string;
  title: string;
  description: string;
  icon: string;
}

export interface SecurityItem {
  title: string;
  description: string;
  icon: string;
}

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}
