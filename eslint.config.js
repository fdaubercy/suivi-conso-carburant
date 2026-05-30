import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window:          'readonly',
        document:        'readonly',
        navigator:       'readonly',
        localStorage:    'readonly',
        sessionStorage:  'readonly',
        Option:          'readonly',
        fetch:           'readonly',
        Response:        'readonly',
        caches:          'readonly',
        Notification:    'readonly',
        atob:            'readonly',
        console:         'readonly',
        confirm:         'readonly',
        alert:           'readonly',
        FileReader:      'readonly',
        Image:           'readonly',
        Event:           'readonly',
        URL:             'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal:     'readonly',
        crypto:          'readonly',
        setTimeout:      'readonly',
        clearTimeout:    'readonly',
        setInterval:     'readonly',
        clearInterval:   'readonly',
        performance:     'readonly',
        // Canvas / File API
        HTMLCanvasElement: 'readonly',
      },
    },
    rules: {
      'no-unused-vars':       ['warn', { argsIgnorePattern: '^_' }],
      'no-undef':             'error',
      'no-console':           'off',
      'prefer-const':         'warn',
      'no-var':               'error',
      'eqeqeq':               ['warn', 'smart'],
      'no-duplicate-imports': 'error',
    },
  },
  {
    // Ignorer les fichiers non-JS dans le scan
    ignores: ['node_modules/**', 'dist/**'],
  },
];
