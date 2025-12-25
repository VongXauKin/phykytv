
export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

export interface Movie {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
}

export interface Settings {
  wallpaper: string;
  tvSourceUrl: string;
  epgUrl: string;
  movieSourceUrl: string;
}

export interface User {
  username: string;
  password?: string;
  avatar: string;
  role: 'admin' | 'user';
}

export type AppView = 'login' | 'home' | 'tv' | 'movies';
