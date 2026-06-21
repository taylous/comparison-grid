import type { Meta, StoryObj } from 'storybook-react-rsbuild';

// 스캐폴딩 검증용 예시 스토리. 실제 라이브러리 컴포넌트가 생기면 교체/삭제한다.
function Hello({ label }: { label: string }) {
  return <div>{label}</div>;
}

const meta = {
  title: 'Example/Hello',
  component: Hello,
  args: { label: 'comparison-grid' },
} satisfies Meta<typeof Hello>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
