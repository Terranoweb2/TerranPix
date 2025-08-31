/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-4 px-8 flex items-center bg-gray-900/30 border-b border-gray-700 backdrop-blur-sm">
      <h1 className="text-2xl font-bold tracking-tight text-white">TerraPix</h1>
    </header>
  );
};

export default Header;
