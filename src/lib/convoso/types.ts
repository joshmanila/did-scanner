export interface ConvosoClientConfig {
  apiUrl: string;
  authToken: string;
}

export interface ConvosoCallLog {
  id: string;
  lead_id: string;
  list_id: string;
  campaign_id: string;
  campaign: string;
  user: string;
  user_id: string;
  phone_number: string;
  number_dialed: string;
  caller_id: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  status_name: string;
  call_length: string | null;
  call_date: string;
  agent_comment: string | null;
  term_reason: string;
  call_type: string;
}

export interface ConvosoLogResponse {
  offset: number;
  limit: number;
  total_found: number;
  entries: number;
  results: ConvosoCallLog[];
}
