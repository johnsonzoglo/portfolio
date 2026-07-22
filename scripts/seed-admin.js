const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDirectory = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDirectory, 'users.json');

function readHidden(prompt) {
  if (process.env.ADMIN_PASSWORD) return Promise.resolve(process.env.ADMIN_PASSWORD);
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    return Promise.reject(new Error('An interactive terminal is required.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
    };
    const onData = input => {
      for (const character of input) {
        if (character === '\u0003') {
          finish();
          reject(new Error('Password update cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

async function main() {
  const password = await readHidden('New owner password: ');
  if (password.length < 12) throw new Error('Password must contain at least 12 characters.');

  fs.mkdirSync(dataDirectory, { recursive: true });
  let users = [];
  try {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    if (!Array.isArray(users)) users = [];
  } catch {}

  const owner = users.find(user => user.username === 'owner');
  if (owner) {
    owner.passwordHash = hashPassword(password);
    owner.active = true;
    owner.role = 'owner';
  } else {
    users.unshift({
      id: crypto.randomUUID(),
      username: 'owner',
      name: 'Johnson Zoglo',
      role: 'owner',
      passwordHash: hashPassword(password),
      active: true,
      createdAt: new Date().toISOString()
    });
  }

  const temporary = `${usersFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(users, null, 2));
  fs.renameSync(temporary, usersFile);
  console.log('Owner password seeded successfully.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
