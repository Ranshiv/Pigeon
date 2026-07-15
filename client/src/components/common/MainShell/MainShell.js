// client/src/components/common/MainShell/MainShell.js
import React from 'react';

const MainShell = ({ children, className = '' }) => {
  return <div className={`main-shell ${className}`.trim()}>{children}</div>;
};

export default MainShell;
