import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  globalIgnores(['dist/*']),
)
