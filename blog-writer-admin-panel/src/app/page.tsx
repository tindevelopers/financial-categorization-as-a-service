import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to the blog writer template
  redirect('/templates/blog-writer');
}