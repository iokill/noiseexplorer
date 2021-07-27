{
const g = {
	s: 0,
	e: 0,
	rs: 0,
	re: 0,
	ss: 0,
	se: 0,
	es: 0,
	ee: 0
};

const util = {
	hasDuplicates: (arr) => {
		let vo = {};
		for (let i = 0; i < arr.length; ++i) {
			let v = arr[i];
			if (v in vo) { return true; }
			vo[v] = true;
		}
		return false;
	}
};

const errMsg = {
	// Below are validity rules specific to Noise Explorer and not to the Noise Protocol Framework.
	tooLongName: 'Noise Handshake Pattern names with a maximum length of 16 characters are currently supported.',
	tooManyTokens: 'Noise Message Patterns with a maximum of 8 tokens are currently supported.',
	tooManyMessages: 'Noise Handshake Patterns with a maximum of 8 message patterns are currently supported.',
	moreThanOnePsk: 'Noise Handshake Patterns with a maximum of one PSK are currently supported.',
	// Below are validity rules which we are not exactly sure are shared by the Noise Protocol Framework (but likely are.)
	tokenOrderIncorrect: 'Public key tokens must be ordered in a message to appear before Diffie-Hellman operations that implicate them.',
	transportNotLast: 'Noise Handshake Patterns can only contain transport handshake messages at the very bottom of the pattern.',
	transportOnly: 'Noise Handshake Patterns cannot consist purely of transport messages.',
	unusedKeySent: 'Noise Handshake Patterns should not contain key shares that are not subsequently used in any Diffie-Hellman operation.',
	// Below are validity rules shared by the Noise Protocol Framework.
	dupTokens: 'Noise Handshake Patterns must not contain duplicate tokens in the same message flight.',
	keySentMoreThanOnce: 'Principals must not send their static public key or ephemeral public key more than once per handshake.',
	dhSentMoreThanOnce: 'Principals must not perform the same Diffie-Hellman key agreement more than once per handshake.',
	wrongPskModifier: 'PSK modifiers must correctly indicate the position of PSK tokens.',
	wrongPskLocation: 'PSK tokens must appear at the beginning or end of the first handshake message or at the end of any other handshake message.',
	pskNotAtEndOfName: 'PSK modifiers must appear at the end of the Noise Handshake Pattern name.',
	wrongMessageDir: 'Message direction within a Noise Handshake Pattern must alternate (initiator -> responder, initiator <- responder), with the first message being sent by the initiator.',
	dhWithUnknownKey: 'Principals cannot perform a Diffie-Hellman operation with a key share that does not exist.',
	seEeRule: 'After an se token, the initiator must not send a handshake payload or transport payload unless there has also been an ee token.',
	ssEsRule: 'After an ss token, the initiator must not send a handshake payload or transport payload unless there has also been an es token.',
	esEeRule: 'After an es token, the responder must not send a handshake payload or transport payload unless there has also been an ee token.',
	ssSeRule: 'After an ss token, the responder must not send a handshake payload or transport payload unless there has also been an se token.'
};

const check = {
	preMessages: (pattern) => {
		pattern.preMessages.forEach((preMessage) => {
			if (preMessage.tokens.indexOf('s') >= 0) {
				(preMessage.dir === 'send')? g.s++ : g.rs++;
			}
			if (preMessage.tokens.indexOf('e') >= 0) {
				(preMessage.dir === 'send')? g.e++ : g.re++;
			}
		});
	},
	messages: (pattern) => {
		if (pattern.messages.length > 8) {
			error(errMsg.tooManyMessages);
		}
		pattern.messages.forEach((message, i) => {
			if (
				((i % 2)  && (message.dir === 'send')) ||
				(!(i % 2) && (message.dir === 'recv'))
			) {
				error(errMsg.wrongMessageDir);
			}
			if (util.hasDuplicates(message.tokens)) {
				error(errMsg.dupTokens);
			}
			if (message.tokens.length > 8) {
				error(errMsg.tooManyTokens);
			}
			if (message.tokens.indexOf('s') >= 0) {
				if (((message.dir === 'send') && (
					(
						(message.tokens.indexOf('se') >= 0) &&
						(message.tokens.indexOf('se') < message.tokens.indexOf('s'))
					) || (
						(message.tokens.indexOf('ss') >= 0) &&
						(message.tokens.indexOf('ss') < message.tokens.indexOf('s'))
					)
				)) || ((message.dir === 'recv') && (
					(
						(message.tokens.indexOf('es') >= 0) &&
						(message.tokens.indexOf('es') < message.tokens.indexOf('s'))
					) || (
						(message.tokens.indexOf('ss') >= 0) &&
						(message.tokens.indexOf('ss') < message.tokens.indexOf('s'))
					)
				))) {
					error(errMsg.tokenOrderIncorrect);
				}
				(message.dir === 'send')? g.s++ : g.rs++;
			}
			if (message.tokens.indexOf('e') >= 0) {
				if (((message.dir === 'send') && (
					(
						(message.tokens.indexOf('es') >= 0) &&
						(message.tokens.indexOf('es') < message.tokens.indexOf('e'))
					) || (
						(message.tokens.indexOf('ee') >= 0) &&
						(message.tokens.indexOf('ee') < message.tokens.indexOf('e'))
					)
				)) || ((message.dir === 'recv') && (
					(
						(message.tokens.indexOf('se') >= 0) &&
						(message.tokens.indexOf('se') < message.tokens.indexOf('e'))
					) || (
						(message.tokens.indexOf('ee') >= 0) &&
						(message.tokens.indexOf('ee') < message.tokens.indexOf('e'))
					)
				))) {
					error(errMsg.tokenOrderIncorrect);
				}
				(message.dir === 'send')? g.e++ : g.re++;
			}
			if (message.tokens.indexOf('ss') >= 0) {
				g.ss++;
				if (
					(message.dir === 'send') &&
					(g.es === 0) &&
					(message.tokens.indexOf('es') < 0)
				) {
					error(errMsg.ssEsRule);
				}
				if (
					(message.dir === 'recv') &&
					(g.se === 0) &&
					(message.tokens.indexOf('se') < 0)
				) {
					error(errMsg.ssSeRule);
				}
			}
			if (message.tokens.indexOf('se') >= 0) {
				g.se++;
				if (
					(message.dir === 'send') &&
					(g.ee === 0) &&
					(message.tokens.indexOf('ee') < 0)
				) {
					error(errMsg.seEeRule);
				}
			}
			if (message.tokens.indexOf('es') >= 0) {
				g.es++;
				if (
					(message.dir === 'recv') &&
					(g.ee === 0) &&
					(message.tokens.indexOf('ee') < 0)
				) {
					error(errMsg.esEeRule);
				}
			}
			if (message.tokens.indexOf('ee') >= 0) {
				g.ee++;
			}
			if (
				(g.ss && (!g.s || !g.rs)) ||
				(g.se && (!g.s || !g.re)) ||
				(g.es && (!g.e || !g.rs)) ||
				(g.ee && (!g.e || !g.re))
		 	) {
				error(errMsg.dhWithUnknownKey);
			}
		});
		if (
			(g.s  && (!g.ss && !g.se)) ||
			(g.e  && (!g.es && !g.ee)) ||
			(g.rs && (!g.ss && !g.es)) ||
			(g.re && (!g.se && !g.ee))
		) {
			error(errMsg.unusedKeySent);
		}
		if  (
			(g.s > 1) || (g.e > 1) ||
			(g.rs > 1) || (g.re > 1)
		) {
			error(errMsg.keySentMoreThanOnce);
		}
		if  (
			(g.ee > 1) || (g.es > 1) ||
			(g.se > 1) || (g.ss > 1)
		) {
			error(errMsg.dhSentMoreThanOnce);
		}
	},
	psk: (pattern) => {
		let pskMods = pattern.name.match(/psk\d/g);
		if (!pskMods) {
			pattern.messages.forEach((message) => {
				if (message.tokens.indexOf('psk') >= 0) {
					error(errMsg.wrongPskModifier);
				}
			});
			return false;
		}
		if (pskMods.length > 1) {
			error(errMsg.moreThanOnePsk);
		}
		if (!/psk\d$/.test(pattern.name)) {
			error(errMsg.pskNotAtEndOfName);
		}
		pskMods.forEach((pskMod) => {
			pskMod = parseInt(pskMod.charAt(3), 10);
			if (pskMod > pattern.messages.length) {
				error(errMsg.wrongPskModifier);
			} else if (pskMod === 0) {
				let tokens = pattern.messages[pskMod].tokens;
				if (tokens.indexOf('psk') < 0) {
					error(errMsg.wrongPskModifier);
				} else if (tokens.indexOf('psk') > 0) {
					error(errMsg.wrongPskLocation);
				}
			} else {
				let tokens = pattern.messages[pskMod - 1].tokens;
				if (tokens.indexOf('psk') < 0) {
					error(errMsg.wrongPskModifier);
				} else if (tokens.indexOf('psk') !== (tokens.length - 1)) {
					(pskMod === 1)? error(errMsg.wrongPskModifier) : error(errMsg.wrongPskLocation);
				}
			}
		});
	},
	transportMessages: (pattern) => {
		let transportMessage = -1;
		pattern.messages.forEach((message, i) => {
			if (
				(message.tokens.length === 0) &&
				(transportMessage === -1)
			) {
				transportMessage = i;
			}
			if (
				(message.tokens.length > 0) &&
				(transportMessage >= 0) &&
				(i > transportMessage)
			) {
				error(errMsg.transportNotLast);
			}
		});
		if (pattern.messages[0].tokens.length === 0) {
			error(errMsg.transportOnly);
		}
	}
};
}

Pattern =
	Name:Identifier ':' _
    PreMessages:PreMessages? _
    Messages:Messages {
		let pattern = {
			name: Name,
			preMessages: [],
			messages: Messages
		};
		pattern.preMessages = PreMessages? PreMessages : [];
		check.preMessages(pattern);
		check.messages(pattern);
		check.psk(pattern);
		check.transportMessages(pattern);
    	return pattern;
    }

Identifier =
	[a-zA-Z0-9]+ {
		if (text().length > 16) {
			error(errMsg.tooLongName);
		} else {
			return text();
		}
	}

_  =
	[ \t\n\r]* {
		return text();
	}

Ellipsis =
	_ '...' _ {
		return (text().length > 0)
	}

Arrow =
	'->' {
		return 'send';
	} /
	'<-' {
		return 'recv';
	}

Token =
	('psk' / 'ss' / 'se' / 'es' / 'ee' / 's' / 'e') {
		return text();
	}

PreMessageToken =
	('e, s' / 'e' / 's') {
		return text();
	}
    
Tokens =
	(Token (', ' / ','))* Token {
		let normalized = text().replace(/\,\s/g, ',');
		return normalized.split(',');
	}
    
PreMessage =
	_ Dir:Arrow _ Token:PreMessageToken {
		return {
			type: 'PreMessage',
			dir: Dir,
			tokens: Token
		};
	}

PreMessages =
	PreMessages:((PreMessage _) (PreMessage _)? Ellipsis) {
		let pMsg = [PreMessages[0][0]];
		if (!Array.isArray(PreMessages[1])) {
			// Do nothing.
		} else if (PreMessages[1][0].dir === 'recv') {
			pMsg.push(PreMessages[1][0]);
		} else if (PreMessages[1][0].dir === 'send') {
			pMsg.unshift(PreMessages[1][0]);
		}
		return pMsg;
	}
    
Message =
	_ Dir:Arrow _ Tokens:Tokens? {
		return {
			type: 'Message',
			dir: Dir,
			tokens: Tokens? Tokens : []
		};
	}

Messages =
	Messages:(Message _)+ {
		let msgs = [];
		Messages.forEach((msg, i) => {
			msgs.push(msg[0]);
		});
		return msgs;
	}