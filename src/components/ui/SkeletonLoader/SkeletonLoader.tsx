import React from 'react';
import './SkeletonLoader.css';

export type SkeletonType = 'text' | 'circle' | 'rectangle' | 'card' | 'recipe-card' | 'image';

interface SkeletonLoaderProps {
  type?: SkeletonType;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  width = '100%',
  height = '20px',
  borderRadius = '4px',
  count = 1,
  className = '',
  style = {}
}) => {
  const getDefaultDimensions = () => {
    switch (type) {
      case 'circle':
        return { width: '50px', height: '50px', borderRadius: '50%' };
      case 'rectangle':
        return { width: '100%', height: '200px', borderRadius: '8px' };
      case 'image':
        return { width: '100%', height: '300px', borderRadius: '8px' };
      case 'card':
        return { width: '100%', height: '300px', borderRadius: '8px' };
      case 'recipe-card':
        return { width: '100%', height: '400px', borderRadius: '8px' };
      case 'text':
      default:
        return { width, height, borderRadius };
    }
  };

  const dimensions = getDefaultDimensions();

  const skeletonStyle: React.CSSProperties = {
    display: 'inline-block',
    width: width || dimensions.width,
    height: height || dimensions.height,
    borderRadius: borderRadius || dimensions.borderRadius,
    backgroundColor: 'var(--skeleton-bg-color, #e0e0e0)',
    backgroundImage:
      'linear-gradient(90deg, var(--skeleton-bg-color, #e0e0e0) 25%, var(--skeleton-shimmer-color, #f0f0f0) 50%, var(--skeleton-bg-color, #e0e0e0) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-loading 1.5s infinite',
    ...style
  };

  if (type === 'recipe-card') {
    return (
      <div className={`skeleton-recipe-card ${className}`}>
        <div className="skeleton-image" style={{ height: '200px', marginBottom: '12px' }} />
        <div className="skeleton-content">
          <div className="skeleton-text" style={{ height: '20px', marginBottom: '8px', width: '80%' }} />
          <div className="skeleton-text" style={{ height: '16px', marginBottom: '12px', width: '60%' }} />
          <div className="skeleton-text" style={{ height: '16px', marginBottom: '12px', width: '70%' }} />
          <div className="skeleton-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <div className="skeleton-button" style={{ flex: 1, height: '32px' }} />
            <div className="skeleton-button" style={{ width: '40px', height: '32px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`skeleton-card ${className}`}>
        <div className="skeleton-image" style={{ height: '180px', marginBottom: '12px' }} />
        <div className="skeleton-content">
          <div className="skeleton-text" style={{ height: '18px', marginBottom: '8px', width: '70%' }} />
          <div className="skeleton-text" style={{ height: '14px', marginBottom: '12px', width: '50%' }} />
          <div className="skeleton-text" style={{ height: '32px', marginTop: '12px' }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`skeleton-loader ${type} ${className}`}
          style={skeletonStyle}
          role="status"
          aria-label="Loading..."
        />
      ))}
    </>
  );
};

export default SkeletonLoader;
