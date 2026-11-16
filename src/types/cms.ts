export type SheetTabName =
  | 'Yangiliklar'
  | 'Rahbariyat'
  | 'Yonalishlar'
  | 'Hujjatlar'
  | 'Media'
  | 'Sozlamalar'
  | 'Murojaatlar';

export interface SiteConfig {
  spreadsheetId: string;
  rootFolderId: string;
  mediaFolderId: string;
  docsFolderId: string;
  schoolTitle: string;
  configuredAt: string;
  configuredByEmail?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  content: string;
  imageUrl: string;
  driveFileId: string;
  featured: string;
  status: string;
}

export interface LeadershipMember {
  id: string;
  fullName: string;
  role: string;
  department: string;
  receptionHours: string;
  phone: string;
  email: string;
  bio: string;
  imageUrl: string;
  driveFileId: string;
  order: string;
}

export interface AcademicProgram {
  id: string;
  title: string;
  code: string;
  gradeRange: string;
  subjects: string;
  quota: string;
  description: string;
  imageUrl: string;
  driveFileId: string;
}

export interface SchoolDocument {
  id: string;
  title: string;
  docNumber: string;
  category: string;
  date: string;
  summary: string;
  fileUrl: string;
  driveFileId: string;
}

export interface MediaAsset {
  id: string;
  title: string;
  category: string;
  mimeType: string;
  driveFileId: string;
  url: string;
  createdAt: string;
  size: string;
}

export interface SchoolSetting {
  key: string;
  value: string;
  label: string;
  section: string;
}

export interface AppealItem {
  id: string;
  fullName: string;
  phone: string;
  topic: string;
  message: string;
  date: string;
  status: string;
}

export interface SiteDataset {
  news: NewsItem[];
  leadership: LeadershipMember[];
  programs: AcademicProgram[];
  documents: SchoolDocument[];
  media: MediaAsset[];
  settings: Record<string, string>;
  settingsRows: SchoolSetting[];
  appeals: AppealItem[];
}

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}
