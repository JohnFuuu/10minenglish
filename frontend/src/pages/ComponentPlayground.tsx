import { Avatar, Badge, Button, Card, Input, NavItem } from '../components';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-6 border-b border-border pb-3 text-xl font-semibold">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

export function ComponentPlayground() {
  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <h1 className="mb-2 text-3xl font-bold">10ME — Component Playground</h1>
      <p className="mb-12 text-text-secondary">
        Live React components from src/components, styled with the Tailwind
        tokens in src/index.css. Matches docs/kitchen-sink.html.
      </p>

      <Section title="Buttons">
        <Item label="primary">
          <Button>Primary</Button>
        </Item>
        <Item label="primary disabled">
          <Button disabled>Primary</Button>
        </Item>
        <Item label="primary small">
          <Button size="sm">Primary</Button>
        </Item>
        <Item label="secondary">
          <Button variant="secondary">Secondary</Button>
        </Item>
        <Item label="secondary disabled">
          <Button variant="secondary" disabled>
            Secondary
          </Button>
        </Item>
      </Section>

      <Section title="Inputs">
        <Item label="default">
          <Input placeholder="Placeholder text" />
        </Item>
        <Item label="filled">
          <Input defaultValue="sarah@example.com" />
        </Item>
        <Item label="error">
          <Input defaultValue="not-an-email" error="Please enter a valid email" />
        </Item>
        <Item label="disabled">
          <Input defaultValue="Locked field" disabled />
        </Item>
      </Section>

      <Section title="Badge & Avatar">
        <Item label="badge">
          <Badge count={3} />
        </Item>
        <Item label="avatar 32">
          <Avatar initials="JD" size={32} />
        </Item>
        <Item label="avatar 40">
          <Avatar initials="JD" size={40} />
        </Item>
        <Item label="avatar 56">
          <Avatar initials="JD" size={56} />
        </Item>
      </Section>

      <Section title="Nav Item">
        <div className="flex w-56 flex-col gap-1">
          <NavItem label="Profile" />
          <NavItem label="Dashboard" active />
          <NavItem label="Notifications" badge={<Badge count={3} />} />
        </div>
      </Section>

      <Section title="Cards">
        <Card className="w-64">
          <p className="mb-1 text-xl font-semibold">Card title</p>
          <p className="text-sm text-text-secondary">Supporting detail text</p>
        </Card>

        <Card className="flex w-72 flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar initials="MS" size={40} />
            <div>
              <div className="font-semibold">Maria Santos</div>
              <div className="text-sm text-text-secondary">Today, 3:00 PM</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm">Join Lesson</Button>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </div>
        </Card>

        <Card className="flex w-48 flex-col items-center gap-2 text-center">
          <Avatar initials="YT" size={56} />
          <div className="font-semibold">Yuki Tanaka</div>
          <div className="text-xs text-text-secondary">Tokyo, Japan</div>
          <Button size="sm">Book</Button>
        </Card>
      </Section>
    </main>
  );
}
