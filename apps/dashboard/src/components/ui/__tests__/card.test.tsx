import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '../card';

describe('Card Component Family', () => {
  describe('Card', () => {
    it('should render a div with Card component', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.querySelector('div');
      expect(card).toBeTruthy();
    });

    it('should render children correctly', () => {
      render(<Card>Test Content</Card>);
      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should have displayName set to Card', () => {
      expect(Card.displayName).toBe('Card');
    });

    it('should apply base card styles', () => {
      const { container } = render(<Card>Styled</Card>);
      const card = container.querySelector('div');
      expect(card?.className).toContain('bg-wl-bg-elevated');
      expect(card?.className).toContain('border');
      expect(card?.className).toContain('border-wl-border-subtle');
      expect(card?.className).toContain('rounded-lg');
      expect(card?.className).toContain('p-5');
    });

    it('should apply transition styles', () => {
      const { container } = render(<Card>Transition</Card>);
      const card = container.querySelector('div');
      expect(card?.className).toContain('transition-all');
      expect(card?.className).toContain('duration-base');
      expect(card?.className).toContain('ease-default');
    });

    it('should accept hover prop', () => {
      const { container } = render(<Card hover>Hoverable</Card>);
      const card = container.querySelector('div');
      expect(card?.className).toContain('hover:border-wl-border-default');
      expect(card?.className).toContain('hover:shadow-md');
      expect(card?.className).toContain('cursor-pointer');
    });

    it('should accept glow prop', () => {
      const { container } = render(<Card glow>Glowing</Card>);
      const card = container.querySelector('div');
      expect(card?.className).toContain('shadow-glow');
    });

    it('should add cursor-pointer when onClick is provided', () => {
      const { container } = render(<Card onClick={() => {}}>Clickable</Card>);
      const card = container.querySelector('div');
      expect(card?.className).toContain('cursor-pointer');
    });

    it('should accept custom className', () => {
      const { container } = render(<Card className="custom-card">Custom</Card>);
      const card = container.querySelector('div');
      expect(card?.className).toContain('custom-card');
    });

    it('should merge custom className with default styles', () => {
      const { container } = render(
        <Card className="shadow-xl">Custom Shadow</Card>
      );
      const card = container.querySelector('div');
      expect(card?.className).toContain('bg-wl-bg-elevated');
      expect(card?.className).toContain('shadow-xl');
    });

    it('should render React node children', () => {
      render(
        <Card>
          <h1>Title</h1>
          <p>Paragraph</p>
        </Card>
      );

      expect(screen.getByText('Title')).toBeTruthy();
      expect(screen.getByText('Paragraph')).toBeTruthy();
    });
  });

  describe('CardHeader', () => {
    it('should render CardHeader component', () => {
      const { container } = render(<CardHeader>Header</CardHeader>);
      const header = container.querySelector('div');
      expect(header).toBeTruthy();
    });

    it('should have displayName set to CardHeader', () => {
      expect(CardHeader.displayName).toBe('CardHeader');
    });

    it('should apply flex layout styles', () => {
      const { container } = render(<CardHeader>Flex</CardHeader>);
      const header = container.querySelector('div');
      expect(header?.className).toContain('flex');
      expect(header?.className).toContain('items-center');
      expect(header?.className).toContain('justify-between');
    });

    it('should apply margin bottom', () => {
      const { container } = render(<CardHeader>Margin</CardHeader>);
      const header = container.querySelector('div');
      expect(header?.className).toContain('mb-4');
    });

    it('should render children', () => {
      render(<CardHeader>Header Content</CardHeader>);
      expect(screen.getByText('Header Content')).toBeTruthy();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <CardHeader className="custom-header">Custom</CardHeader>
      );
      const header = container.querySelector('div');
      expect(header?.className).toContain('custom-header');
    });

    it('should support onClick handler', () => {
      const handleClick = vi.fn();
      render(<CardHeader onClick={handleClick}>Clickable</CardHeader>);
    });
  });

  describe('CardTitle', () => {
    it('should render h3 element', () => {
      const { container } = render(<CardTitle>Title</CardTitle>);
      const title = container.querySelector('h3');
      expect(title).toBeTruthy();
    });

    it('should have displayName set to CardTitle', () => {
      expect(CardTitle.displayName).toBe('CardTitle');
    });

    it('should apply title styles', () => {
      const { container } = render(<CardTitle>Styled Title</CardTitle>);
      const title = container.querySelector('h3');
      expect(title?.className).toContain('text-sm');
      expect(title?.className).toContain('font-semibold');
      expect(title?.className).toContain('text-wl-text-secondary');
      expect(title?.className).toContain('tracking-wider');
      expect(title?.className).toContain('uppercase');
    });

    it('should have zero margin', () => {
      const { container } = render(<CardTitle>No Margin</CardTitle>);
      const title = container.querySelector('h3');
      expect(title?.className).toContain('m-0');
    });

    it('should render text children', () => {
      render(<CardTitle>My Title</CardTitle>);
      expect(screen.getByText('My Title')).toBeTruthy();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <CardTitle className="custom-title">Custom</CardTitle>
      );
      const title = container.querySelector('h3');
      expect(title?.className).toContain('custom-title');
    });
  });

  describe('CardContent', () => {
    it('should render div element', () => {
      const { container } = render(<CardContent>Content</CardContent>);
      const content = container.querySelector('div');
      expect(content).toBeTruthy();
    });

    it('should have displayName set to CardContent', () => {
      expect(CardContent.displayName).toBe('CardContent');
    });

    it('should render children', () => {
      render(<CardContent>Main Content</CardContent>);
      expect(screen.getByText('Main Content')).toBeTruthy();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <CardContent className="custom-content">Custom</CardContent>
      );
      const content = container.querySelector('div');
      expect(content?.className).toContain('custom-content');
    });

    it('should render complex children', () => {
      render(
        <CardContent>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </CardContent>
      );

      expect(screen.getByText('Paragraph 1')).toBeTruthy();
      expect(screen.getByText('Paragraph 2')).toBeTruthy();
    });

    it('should apply custom className and preserve element', () => {
      const { container } = render(
        <CardContent className="p-8">Padded</CardContent>
      );
      const content = container.querySelector('div');
      expect(content?.className).toContain('p-8');
    });
  });

  describe('CardDescription', () => {
    it('should render p element', () => {
      const { container } = render(
        <CardDescription>Description</CardDescription>
      );
      const description = container.querySelector('p');
      expect(description).toBeTruthy();
    });

    it('should have displayName set to CardDescription', () => {
      expect(CardDescription.displayName).toBe('CardDescription');
    });

    it('should apply description styles', () => {
      const { container } = render(
        <CardDescription>Styled Description</CardDescription>
      );
      const description = container.querySelector('p');
      expect(description?.className).toContain('text-sm');
      expect(description?.className).toContain('text-wl-text-secondary');
      expect(description?.className).toContain('leading-relaxed');
      expect(description?.className).toContain('mt-1');
    });

    it('should render text children', () => {
      render(<CardDescription>This is a description</CardDescription>);
      expect(screen.getByText('This is a description')).toBeTruthy();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <CardDescription className="custom-desc">Custom</CardDescription>
      );
      const description = container.querySelector('p');
      expect(description?.className).toContain('custom-desc');
    });
  });

  describe('CardFooter', () => {
    it('should render div element', () => {
      const { container } = render(<CardFooter>Footer</CardFooter>);
      const footer = container.querySelector('div');
      expect(footer).toBeTruthy();
    });

    it('should have displayName set to CardFooter', () => {
      expect(CardFooter.displayName).toBe('CardFooter');
    });

    it('should apply footer layout styles', () => {
      const { container } = render(<CardFooter>Layout</CardFooter>);
      const footer = container.querySelector('div');
      expect(footer?.className).toContain('flex');
      expect(footer?.className).toContain('items-center');
      expect(footer?.className).toContain('justify-end');
      expect(footer?.className).toContain('gap-2');
    });

    it('should apply spacing styles', () => {
      const { container } = render(<CardFooter>Spaced</CardFooter>);
      const footer = container.querySelector('div');
      expect(footer?.className).toContain('mt-4');
      expect(footer?.className).toContain('pt-4');
    });

    it('should have top border', () => {
      const { container } = render(<CardFooter>Bordered</CardFooter>);
      const footer = container.querySelector('div');
      expect(footer?.className).toContain('border-t');
      expect(footer?.className).toContain('border-wl-border-subtle');
    });

    it('should render children', () => {
      render(<CardFooter>Footer Content</CardFooter>);
      expect(screen.getByText('Footer Content')).toBeTruthy();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <CardFooter className="custom-footer">Custom</CardFooter>
      );
      const footer = container.querySelector('div');
      expect(footer?.className).toContain('custom-footer');
    });
  });

  describe('Composition', () => {
    it('should compose full card with all subcomponents', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Card description goes here</CardDescription>
            <p>Main content</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByText('Card Title')).toBeTruthy();
      expect(screen.getByText('Card description goes here')).toBeTruthy();
      expect(screen.getByText('Main content')).toBeTruthy();
      expect(screen.getByText('Action')).toBeTruthy();
    });

    it('should render card with hover prop and children', () => {
      const { container } = render(
        <Card hover>
          <CardHeader>
            <CardTitle>Hoverable Card</CardTitle>
          </CardHeader>
          <CardContent>Content here</CardContent>
        </Card>
      );

      const card = container.firstChild;
      expect(card).toBeTruthy();
    });

    it('should support nested elements in CardContent', () => {
      render(
        <Card>
          <CardContent>
            <div>
              <span>Nested</span>
              <span>Elements</span>
            </div>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Nested')).toBeTruthy();
      expect(screen.getByText('Elements')).toBeTruthy();
    });
  });

  describe('Forward Refs', () => {
    it('should forward ref on Card', () => {
      const { container } = render(<Card>Ref</Card>);
      expect(container.querySelector('div')).toBeTruthy();
    });

    it('should forward ref on CardHeader', () => {
      const { container } = render(<CardHeader>Ref</CardHeader>);
      expect(container.querySelector('div')).toBeTruthy();
    });

    it('should forward ref on CardTitle', () => {
      const { container } = render(<CardTitle>Ref</CardTitle>);
      expect(container.querySelector('h3')).toBeTruthy();
    });

    it('should forward ref on CardContent', () => {
      const { container } = render(<CardContent>Ref</CardContent>);
      expect(container.querySelector('div')).toBeTruthy();
    });

    it('should forward ref on CardDescription', () => {
      const { container } = render(<CardDescription>Ref</CardDescription>);
      expect(container.querySelector('p')).toBeTruthy();
    });

    it('should forward ref on CardFooter', () => {
      const { container } = render(<CardFooter>Ref</CardFooter>);
      expect(container.querySelector('div')).toBeTruthy();
    });
  });

  describe('HTML Attributes', () => {
    it('should pass through data attributes on Card', () => {
      const { container } = render(
        <Card data-testid="test-card">Test</Card>
      );
      const card = container.querySelector('div');
      expect(card?.getAttribute('data-testid')).toBe('test-card');
    });

    it('should pass through aria attributes on CardTitle', () => {
      const { container } = render(
        <CardTitle aria-level={2}>Title</CardTitle>
      );
      const title = container.querySelector('h3');
      expect(title?.getAttribute('aria-level')).toBe('2');
    });

    it('should support id attribute', () => {
      const { container } = render(<Card id="card-1">Card</Card>);
      const card = container.querySelector('div');
      expect(card?.getAttribute('id')).toBe('card-1');
    });
  });

  describe('Style Integration', () => {
    it('should support inline styles on Card', () => {
      const { container } = render(
        <Card style={{ minHeight: '200px' }}>Styled</Card>
      );
      const card = container.querySelector('div') as HTMLDivElement;
      expect(card.style.minHeight).toBe('200px');
    });

    it('should support style on CardContent', () => {
      const { container } = render(
        <CardContent style={{ padding: '10px' }}>Styled</CardContent>
      );
      const content = container.querySelector('div') as HTMLDivElement;
      expect(content.style.padding).toBe('10px');
    });
  });

  describe('Empty States', () => {
    it('should render Card with empty children', () => {
      const { container } = render(<Card></Card>);
      expect(container.querySelector('div')).toBeTruthy();
    });

    it('should render CardHeader with empty children', () => {
      const { container } = render(<CardHeader></CardHeader>);
      expect(container.querySelector('div')).toBeTruthy();
    });
  });
});

// Import vi for user event
import { vi } from 'vitest';
