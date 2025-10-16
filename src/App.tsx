import { useState, useEffect } from 'react';
import { TextField, Button, Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './App.css';
import * as React from "react";
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

// Type for user stats
interface UserStats {
  username: string;
  stats?: {
    totalCommitContributions: number;
    totalIssueContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalRepositoryContributions: number;
  };
  error?: string;
}

function App() {
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(false);

  const githubToken = import.meta.env.VITE_GITHUB_TOKEN;

  // Fetch stats for a single user
  const fetchUserStats = async (username: string, from: Date | null, to: Date | null): Promise<UserStats> => {
    if (!username || !from || !to) return { username, error: 'Missing date or username' };
    const fromIso = from.toISOString().split('T')[0] + 'T00:00:00Z';
    const toIso = to.toISOString().split('T')[0] + 'T23:59:59Z';
    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubToken ? { 'Authorization': `Bearer ${githubToken}` } : {}),
        },
        body: JSON.stringify({
          query: `{
            user(login: "${username}") {
              contributionsCollection(from: "${fromIso}", to: "${toIso}") {
                totalCommitContributions
                totalIssueContributions
                totalPullRequestContributions
                totalPullRequestReviewContributions
                totalRepositoryContributions
              }
            }
          }`,
        }),
      });
      const data = await res.json();
      if (data.errors || !data.data.user) {
        return { username, error: 'User not found or API error.' };
      } else {
        return {
          username,
          stats: data.data.user.contributionsCollection,
        };
      }
    } catch (e) {
      return { username, error: 'Network or API error.' };
    }
  };

  // Add user and fetch stats for current date range
  const handleAddUser = async () => {
    if (!username || !fromDate || !toDate) return;
    setLoading(true);
    const newUserStats = await fetchUserStats(username, fromDate, toDate);
    setUsers((prev) => {
      // Avoid duplicates
      if (prev.some(u => u.username.toLowerCase() === username.toLowerCase())) return prev;
      return [...prev, newUserStats];
    });
    setLoading(false);
    setUsername('');
  };

  const handleRemoveUser = (username:string) => {
      if(!username) return;

      setUsers((prev) => prev.filter(u => u.username.toLowerCase() !== username.toLowerCase()));
  }

  // Pre-populate users from .env on first load
  useEffect(() => {
    const envUsers = (import.meta.env.VITE_GITHUB_USERS || '').split(',').map(u => u.trim()).filter(Boolean);
    if (envUsers.length > 0) {
      setUsers(prev => {
        // Only add users not already present
        const existing = prev.map(u => u.username.toLowerCase());
        const newUsers: UserStats[] = envUsers
          .filter(u => !existing.includes(u.toLowerCase()))
          .map(username => ({ username }));
        return [...prev, ...newUsers];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch all users' stats when date range changes
  useEffect(() => {
    if (!fromDate || !toDate || users.length === 0) return;
    setLoading(true);
    Promise.all(users.map(u => fetchUserStats(u.username, fromDate, toDate)))
      .then(updatedUsers => setUsers(updatedUsers))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>GitHub Stats Viewer</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <DatePicker
              label="From"
              value={fromDate}
              onChange={setFromDate}
              maxDate={toDate || undefined}
              format="dd/MM/yyyy"
              renderInput={(params) => <TextField {...params} />}
            />
          </Grid>
          <Grid item>
            <DatePicker
              label="To"
              value={toDate}
              onChange={setToDate}
              minDate={fromDate || undefined}
              format="dd/MM/yyyy"
              renderInput={(params) => <TextField {...params} />}
            />
          </Grid>
          <Grid item>
            <TextField
              label="GitHub Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddUser(); }}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              onClick={handleAddUser}
              disabled={loading || !username || !fromDate || !toDate}
            >
              {loading ? 'Adding...' : 'Add User'}
            </Button>
          </Grid>
        </Grid>
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={2}>
            {users.map((user, idx) => (
              <Grid item key={user.username + idx} xs={12} sm={6} md={4} lg={3}>
                <Card sx={{ minHeight: 200 }}>
                  <CardContent sx={{ position: 'relative' }}>
                    <IconButton
                      size="small"
                      aria-label="Remove user"
                      onClick={() => handleRemoveUser(user.username)}
                      sx={{ position: 'absolute', top: 4, right: 4 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h6" sx={{ pt: 2 }}>
                      {user.username}
                    </Typography>
                    {user.error ? (
                      <Typography color="error">{user.error}</Typography>
                    ) : user.stats ? (
                      (<>
                        <Typography>Commits: {user.stats.totalCommitContributions}</Typography>
                        <Typography>Issues: {user.stats.totalIssueContributions}</Typography>
                        <Typography>PRs: {user.stats.totalPullRequestContributions}</Typography>
                        <Typography>PR Reviews: {user.stats.totalPullRequestReviewContributions}</Typography>
                        <Typography>Repos: {user.stats.totalRepositoryContributions}</Typography>
                      </>) as React.ReactNode
                    ) : null}
                  </CardContent>
                </Card>
              </Grid>
            )) as React.ReactNode}
          </Grid>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}

export default App;
