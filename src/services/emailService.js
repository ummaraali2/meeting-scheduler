export const emailService = {
  sendInvite: async (googleToken, meeting, recipientEmail) => {
    const subject = `Meeting Invite: ${meeting.title}`;
    const body = `
You're invited to a meeting!

Title: ${meeting.title}
Date: ${meeting.date.toLocaleDateString()}
Time: ${meeting.time}
Duration: ${meeting.duration}
Description: ${meeting.description}

Join Meeting: ${meeting.meetingLink}

---
Sent from Meeting Scheduler
    `;

    const email = [
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  },

  sendInvites: async (googleToken, meeting) => {
    const promises = meeting.participants.map(email => 
      emailService.sendInvite(googleToken, meeting, email)
    );

    try {
      await Promise.all(promises);
      return { success: true, count: meeting.participants.length };
    } catch (error) {
      console.error('Error sending invites:', error);
      throw error;
    }
  }
};