export type WorkspaceRow = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
};

export type BoardRow = {
  id: number;
  workspace_id: number;
  parent_board_id: number | null;
  title: string;
  content: string;
  created_by: number;
  created_at: string;
};
