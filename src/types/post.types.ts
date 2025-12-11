/**
 * Types liés aux posts/actualités
 */

export interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: Date | string | any;
  userName: string;
  userId?: string;
  likes?: string[];
  visible?: boolean;
  fromRequest?: boolean;
}

export interface PostData {
  title: string;
  content: string;
  userName: string;
  userId?: string;
  createdAt?: Date | any;
  visible?: boolean;
}

