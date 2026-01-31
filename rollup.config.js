import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  plugins: [
    resolve({
      preferBuiltins: true,
      exportConditions: ['import', 'module', 'node', 'default'],
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
  external: [
    /node_modules/,
  ],
};
