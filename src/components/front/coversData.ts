// Couvertures des numéros affichées dans le header (carrousel).
// Remplacez simplement les fichiers dans public/images et ajustez.
export const COVERS: { file: string; label: string }[] = [
  { file: 'cover-numero-special.jpg', label: 'Numéro spécial' },
  { file: 'cover-interview-1.jpg', label: 'Interview' },
  { file: 'cover-business-1.jpg', label: 'Business' },
  { file: 'cover-dossier-1.jpg', label: 'Dossier' },
  { file: 'cover-entrepreneuriat-1.jpg', label: 'Entrepreneuriat' },
  { file: 'cover-startups-1.jpg', label: 'Startups' },
];

export const coverSrc = (file: string) => `/images/${file}`;
