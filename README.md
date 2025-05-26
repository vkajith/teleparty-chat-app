# Teleparty Chat

A real-time chat application built with React and WebSocket technology, allowing users to create and join chat rooms for seamless communication.

## Features

- 🚀 Real-time messaging with WebSocket
- 👥 Create and join chat rooms
- 🎨 Custom user avatars
- ✨ Typing indicators
- 📱 Responsive design
- 🔒 Room ID sharing
- 💬 Message grouping by user
- 🎯 System messages
- 🌈 Modern UI with smooth animations

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/teleparty-chat-app.git
cd teleparty-chat-app
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm start
# or
yarn start
```

The application will be available at `http://localhost:3000`.

## Usage

### Creating a Room
1. Enter your nickname
2. Select an avatar
3. Click "Create New Room"
4. Share the generated Room ID with others

### Joining a Room
1. Enter your nickname
2. Select an avatar
2. Enter the Room ID
4. Click "Join Room"

### Chat Features
- Messages are grouped by user
- User messages appear on the right
- Other users' messages appear on the left
- System messages are centered
- Typing indicators show when others are typing
- Copy Room ID button for easy sharing
- Leave Room button to exit the chat

## Tech Stack

- React
- TypeScript
- WebSocket
- CSS3
- Font Awesome Icons

## Project Structure

```
src/
├── components/         # React components
├── services/          # WebSocket service
├── types/            # TypeScript type definitions
├── constants/        # Application constants
├── App.tsx           # Main application component
└── App.css           # Global styles
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Create React App](https://create-react-app.dev/)
- Icons by [Font Awesome](https://fontawesome.com/)
- WebSocket implementation using [teleparty-websocket-lib](https://github.com/yourusername/teleparty-websocket-lib)