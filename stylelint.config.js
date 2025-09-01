export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-prettier'],
  rules: {
    'prettier/prettier': true,
    'block-no-empty': null,
    'color-no-invalid-hex': true,
    'unit-allowed-list': ['em', 'rem', '%', 's', 'px', 'vh', 'vw', 'deg', 'ms'],
    'rule-empty-line-before': [
      'always-multi-line',
      {
        except: ['first-nested'],
        ignore: ['after-comment'],
      },
    ],
    'color-hex-length': 'long',
    'selector-class-pattern': null,
    'custom-property-pattern': null,
  },
  ignoreFiles: ['dist/**/*', 'build/**/*', 'node_modules/**/*'],
};
