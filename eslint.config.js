import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  js.configs.recommended,
  ...compat.config({
    extends: [
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:react/jsx-runtime',
      'plugin:react-hooks/recommended',
    ],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    env: {
      browser: true,
      es2020: true,
      node: true
    },
    rules: {
      'react/prop-types': 'off',
      'no-unused-vars': 'warn',
      'react/jsx-key': 'warn'
    }
  }),
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.eslintrc.cjs'
    ]
  }
];