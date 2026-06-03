import {
  AppsIcon,
  DownloadIcon,
  GearIcon,
  BookIcon,
} from "@primer/octicons-react";

export const routes = [
  {
    path: "/catalogue",
    nameKey: "catalogue",
    render: () => <AppsIcon />,
  },
  {
    path: "/library",
    nameKey: "library",
    render: () => <BookIcon />,
  },
  {
    path: "/downloads",
    nameKey: "downloads",
    render: () => <DownloadIcon />,
  },
  {
    path: "/settings",
    nameKey: "settings",
    render: () => <GearIcon />,
  },
];
