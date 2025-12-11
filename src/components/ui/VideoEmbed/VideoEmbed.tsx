import React from 'react';
import ReactPlayer from 'react-player';
import './VideoEmbed.css';

interface VideoEmbedProps {
  url: string;
}

const VideoEmbed: React.FC<VideoEmbedProps> = ({ url }) => {
  if (!url) return null;

  // TikTok : on affiche un lien cliquable (l'embed natif TikTok ne marche pas toujours en React)
  if (/tiktok\.com/.test(url)) {
	return (
	  <div className="video-embed-tiktok">
		<a href={url} target="_blank" rel="noopener noreferrer" className="video-embed-tiktok-link">
		  Voir la vidéo sur TikTok
		</a>
	  </div>
	);
  }

  // Pour YouTube, Instagram, Facebook, etc.
  return (
	<div className="video-embed-player">
	  <ReactPlayer url={url} controls width="100%" />
	</div>
  );
};

export default VideoEmbed;