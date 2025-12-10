import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Download PNG action', () => {
  render(<App />);
  const button = screen.getByText(/Download PNG/i);
  expect(button).toBeInTheDocument();
});
