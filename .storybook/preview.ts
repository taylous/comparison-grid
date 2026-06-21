import type { Preview } from 'storybook-react-rsbuild';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  // 공개 API 의 TSDoc 으로 docs 를 자동 생성한다.
  tags: ['autodocs'],
};

export default preview;
