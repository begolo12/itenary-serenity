import PublicShareView from './PublicShareView';

export default async function PublicSharePage({ params }) {
  const resolved = await params;
  return <PublicShareView shareId={resolved.shareId} />;
}
