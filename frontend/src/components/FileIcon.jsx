import clsx from 'clsx';
import { fileVisual } from '../lib/fileTypes';

export default function FileIcon({ file, size = 'md', className }) {
  const { Icon, color, bg } = fileVisual(file);
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-14 w-14 rounded-2xl' }[size];
  const icon = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }[size];
  return (
    <div className={clsx('flex shrink-0 items-center justify-center', box, bg, className)}>
      <Icon className={clsx(icon, color)} />
    </div>
  );
}
