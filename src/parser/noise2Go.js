const NOISE2GO = {
	parse: () => {}
};

(() => {

const params = {
	attacker: 'passive'
};

const util = {
	emptyKey: 'emptyKey',
	emptyKeyPair: 'keypair{emptyKey, emptyKey}',
	abc: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
};

const preMessagesSendStatic = (pattern) => {
	let r = false;
	pattern.preMessages.forEach((preMessage) => {
		if (
			(preMessage.dir === 'send') &&
			(/s/.test(preMessage.tokens))
		) {
			r = true;
		}
	});
	return r;
};

const preMessagesSendEphemeral = (pattern) => {
	let r = false;
	pattern.preMessages.forEach((preMessage) => {
		if (
			(preMessage.dir === 'send') &&
			(/e/.test(preMessage.tokens))
		) {
			r = true;
		}
	});
	return r;
};

const preMessagesRecvStatic = (pattern) => {
	let r = false;
	pattern.preMessages.forEach((preMessage) => {
		if (
			(preMessage.dir === 'recv') &&
			(/s/.test(preMessage.tokens))
		) {
			r = true;
		}
	});
	return r;
};

const preMessagesRecvEphemeral = (pattern) => {
	let r = false;
	pattern.preMessages.forEach((preMessage) => {
		if (
			(preMessage.dir === 'recv') &&
			(/e/.test(preMessage.tokens))
		) {
			r = true;
		}
	});
	return r;
};

const messagesSendStatic = (pattern) => {
	let r = -1;
	pattern.messages.forEach((message, i) => {
		if (
			(message.dir === 'send') &&
			(message.tokens.indexOf('s') >= 0)
		) {
			r = i;
		}
	});
	return r;
};

const messagesRecvStatic = (pattern) => {
	let r = -1;
	pattern.messages.forEach((message, i) => {
		if (
			(message.dir === 'recv') &&
			((message.tokens.indexOf('s') >= 0))
		) {
			r = i;
		}
	});
	return r;
};

const messagesPsk = (pattern) => {
	let r = -1;
	pattern.messages.forEach((message, i) => {
		if (message.tokens.indexOf('psk') >= 0) {
			r = i;
		}
	});
	return r;
};

const finalKeyExchangeMessage = (pattern) => {
	let r = 0;
	for (let i = 0; i < pattern.messages.length; i++) {
		let b = (
			(i < 1) ||
			(pattern.messages[i - 1].tokens.length)
		);
		let a = (
			(i === (pattern.messages.length - 1)) ||
			(!pattern.messages[i + 1].tokens.length)
		);
		let c = (pattern.messages[i].tokens.length > 0);
		if (a && b && c) {
			r = i;
			break;
		}
	};
	return r;
};

const typeFuns = (pattern) => {
	return [''];
};

const initializeFun = (pattern, initiator, suffix) => {
	let preMessageTokenParsers = {
		send: {
			e: `ss = mixHash(ss, e.pk[:])`,
			s: `ss = mixHash(ss, s.pk[:])`,
			'e, s': `ss = mixHash(mixHash(ss, e.pk[:]), s.pk[:])`
		},
		recv: {
			e: `ss = mixHash(ss, re[:])`,
			s: `ss = mixHash(ss, rs[:])`,
			'e, s': `ss = mixHash(mixHash(ss, re[:]), rs[:])`
		}
	};
	let initFun = [
		`func initialize${suffix}(prologue []byte, s keypair, rs [32]byte, psk [32]byte) handshakestate {`,
		`var ss symmetricstate`,
		`var e keypair`,
		`var re [32]byte`,
		`name := []byte("Noise_${pattern.name}_25519_ChaChaPoly_BLAKE2s")`,
		`ss = mixHash(initializeSymmetric(name), prologue)`
	];
	pattern.preMessages.forEach((preMessage) => {
		let dir = preMessage.dir;
		if (!initiator) {
			dir = (dir === 'send')? 'recv' : 'send';
		}
		initFun.push(preMessageTokenParsers[dir][preMessage.tokens]);
	});
	initFun.push(`return handshakestate{ss, s, e, rs, re, psk, ${initiator}}`);
	return `${initFun.join('\n\t')}\n}`;
};

const initializeFuns = (pattern) => {
	return [
		initializeFun(pattern, true, 'Initiator'),
		initializeFun(pattern, false, 'Responder')
	];
};

const writeMessageFun = (message, hasPsk, initiator, isFinal, suffix) => {
	let ePskFill = hasPsk?
		`ss = mixKey(ss, e.pk)` : `/* No PSK, so skipping mixKey */`;
	let esInitiatorFill = initiator?
		`ss = mixKey(ss, dh(e.sk, rs))` : `ss = mixKey(ss, dh(s.sk, re))`;
	let seInitiatorFill = initiator?
		`ss = mixKey(ss, dh(s.sk, re))` : `ss = mixKey(ss, dh(e.sk, rs))`;
	let finalFill = isFinal? [
		`cs1, cs2 := split(ss)`,
		`return hs, messageBuffer, cs1, cs2`
	] : [
		`return hs, messageBuffer`
	];
	let messageTokenParsers = {
		e: [
			`e = generateKeypair()`,
			`ne = e.pk`,
			`ss = mixHash(ss, ne[:])`,
			ePskFill
		].join(`\n\t`),
		s: [
			`ss, ns = encryptAndHash(ss, s.pk[:])`,
		].join(`\n\t`),
		ee: [
			`ss = mixKey(ss, dh(e.sk, re))`
		].join(`\n\t`),
		es: [
			esInitiatorFill
		].join(`\n\t`),
		se: [
			seInitiatorFill
		].join(`\n\t`),
		ss: [
			`ss = mixKey(ss, dh(s.sk, rs))`
		].join(`\n\t`),
		psk: [
			`ss = mixKeyAndHash(ss, psk)`
		].join(`\n\t`),
	};
	let writeFun = [
		`func writeMessage${suffix}(hs handshakestate, payload []byte) (handshakestate, messagebuffer${isFinal? `, cipherstate, cipherstate` : ``}) {`,
		`ss, s, e, rs, re, psk, initiator := hs.ss, hs.s, hs.e, hs.rs, hs.re, hs.psk, hs.i`,
		`ne, ns, ciphertext := emptyKey, []byte{}, []byte{}`
	];
	message.tokens.forEach((token) => {
		writeFun.push(messageTokenParsers[token]);
	});
	writeFun = writeFun.concat([
		`ss, ciphertext = encryptAndHash(ss, payload)`,
		`hs = handshakestate{ss, s, e, rs, re, psk, initiator}`,
		`messageBuffer := messagebuffer{ne, ns, ciphertext}`,
	]);
	writeFun = writeFun.concat(finalFill);
	return `${writeFun.join('\n\t')}\n}`;
};

const writeMessageFuns = (pattern) => {
	let writeFuns = [];
	let finalKex = finalKeyExchangeMessage(pattern);
	for (let i = 0; i < pattern.messages.length; i++) {
		let message = pattern.messages[i];
		let hasPsk = messagesPsk(pattern) >= 0;
		let initiator = (message.dir === 'send');
		writeFuns.push(
			writeMessageFun(message, hasPsk, initiator, (i === finalKex), util.abc[i])
		);
		if (i > finalKex) {
			break;
		}
	}
	return writeFuns;
};

const readMessageFun = (message, hasPsk, initiator, isFinal, suffix) => {
	let ePskFill = hasPsk?
		`ss = mixKey(ss, re)` : `/* No PSK, so skipping mixKey */`;
	let esInitiatorFill = initiator?
		`ss = mixKey(ss, dh(e.sk, rs))` : `ss = mixKey(ss, dh(s.sk, re))`;
	let seInitiatorFill = initiator?
		`ss = mixKey(ss, dh(s.sk, re))` : `ss = mixKey(ss, dh(e.sk, rs))`;
	let finalFill = isFinal? [
		`cs1, cs2 := split(ss)`,
		`return hs, plaintext, (valid1 && valid2), cs1, cs2`
	] : [
		`return hs, plaintext, (valid1 && valid2)`
	];
	let messageTokenParsers = {
		e: [
			`re = message.ne`,
			`ss = mixHash(ss, re[:])`,
			ePskFill
		].join(`\n\t`),
		s: [
			`ss, ns, valid1 := decryptAndHash(ss, message.ns)`,
			`if !valid1 || len(ns) != 32 {`,
			`\treturn hs, []byte{}, false${isFinal? ', hs.ss.cs, hs.ss.cs' : ''}`,
			`}`,
			`for i := 0; i < 32; i++ {`,
			`\trs[i] = ns[i]`,
			`}`
		].join(`\n\t`),
		ee: [
			`ss = mixKey(ss, dh(e.sk, re))`
		].join(`\n\t`),
		es: [
			esInitiatorFill
		].join(`\n\t`),
		se: [
			seInitiatorFill
		].join(`\n\t`),
		ss: [
			`ss = mixKey(ss, dh(s.sk, rs))`
		].join(`\n\t`),
		psk: [
			`ss = mixKeyAndHash(ss, psk)`
		].join(`\n\t`)
	};
	let readFun = [
		`func readMessage${suffix}(hs handshakestate, message messagebuffer) (handshakestate, []byte, bool${isFinal? `, cipherstate, cipherstate` : ``}) {`,
		`ss, s, e, rs, re, psk, initiator := hs.ss, hs.s, hs.e, hs.rs, hs.re, hs.psk, hs.i`,
		`valid1 := true`
	];
	message.tokens.forEach((token) => {
		readFun.push(messageTokenParsers[token]);
	});
	readFun = readFun.concat([
		`ss, plaintext, valid2 := decryptAndHash(ss, message.ciphertext)`,
		`if !valid2 {`,
		`\treturn hs, []byte{}, false${isFinal? ', hs.ss.cs, hs.ss.cs' : ''}`,
		`}`,
		`hs = handshakestate{ss, s, e, rs, re, psk, initiator}`,
		`${finalFill.join('\n\t')}`
	]);
	return `${readFun.join('\n\t')}\n}`;
};

const readMessageFuns = (pattern) => {
	let readFuns = [];
	let finalKex = finalKeyExchangeMessage(pattern);
	for (let i = 0; i < pattern.messages.length; i++) {
		let message = pattern.messages[i];
		let hasPsk = messagesPsk(pattern) >= 0;
		let initiator = (message.dir === 'recv');
		readFuns.push(
			readMessageFun(message, hasPsk, initiator, (i === finalKex), util.abc[i])
		);
		if (i > finalKex) {
			break;
		}
	}
	return readFuns;
};

const events = (pattern) => {
	return [];
};

const queries = (pattern) => {
	return [];
};

const globals = (pattern) => {
	return [];
};

const initiatorFun = (pattern) => {
	return [];
};

const responderFun = (pattern) => {
	return [];
};

let repeatingKeysQueryFun = (pattern) => {
	return [];
};

const processFuns = (pattern) => {
	let hasPsk = messagesPsk(pattern) >= 0;
	let finalKex = finalKeyExchangeMessage(pattern);
	let initSession = [
		`func InitSession(initiator bool, prologue []byte, s keypair, rs [32]byte${hasPsk? ', psk [32]byte' : ''}) noisesession {`,
		`\tvar session noisesession`,
		`\t${hasPsk? '/* PSK defined by user */' : 'psk := emptyKey'}`,
		`\tif initiator {`,
		`\t\tsession.hs = initializeInitiator(prologue, s, rs, psk)`,
		`\t} else {`,
		`\t\tsession.hs = initializeResponder(prologue, s, rs, psk)`,
		`\t}`,
		`\tsession.mc = 0`,
		`\treturn session`,
		`}`
	];
	let sendMessage = [
		`\nfunc SendMessage(session noisesession, message []byte) (noisesession, messagebuffer) {`,
		`\tvar hs handshakestate`,
		`\tvar messageBuffer messagebuffer`,
		`\ths = session.hs`
	];
	let recvMessage = [
		`\nfunc RecvMessage(session noisesession, message messagebuffer) (noisesession, []byte, bool) {`,
		`\tvar hs handshakestate`,
		`\tvar plaintext []byte`,
		`\tvar valid bool`,
		`\ths = session.hs`
	];
	for (let i = 0; i < pattern.messages.length; i++) {
		if (i < finalKex) {
			sendMessage = sendMessage.concat([
				`\tif session.mc == ${i} {`,
				`\t\ths, messageBuffer = writeMessage${util.abc[i]}(hs, message)`,
				`\t}`
			]);
			recvMessage = recvMessage.concat([
				`\tif session.mc == ${i} {`,
				`\t\ths, plaintext, valid = readMessage${util.abc[i]}(hs, message)`,
				`\t}`
			]);
		} else if (i == finalKex) {
			sendMessage = sendMessage.concat([
				`\tif session.mc == ${i} {`,
				`\t\ths, messageBuffer, session.cs1, session.cs2 = writeMessage${util.abc[i]}(hs, message)`,
				`\t}`
			]);
			recvMessage = recvMessage.concat([
				`\tif session.mc == ${i} {`,
				`\t\ths, plaintext, valid, session.cs1, session.cs2 = readMessage${util.abc[i]}(hs, message)`,
				`\t}`
			]);
		} else {
			sendMessage = sendMessage.concat([
				`\tif session.mc > ${finalKex} {`,
				`\t\tif hs.i {`,
				`\t\t\ths.ss.cs = session.cs1`,
				`\t\t} else {`,
				`\t\t\ths.ss.cs = session.cs2`,
				`\t\t}`,
				`\t\ths, messageBuffer = writeMessage${util.abc[finalKex + 1]}(hs, message)`,
				`\t\tif hs.i {`,
				`\t\t\tsession.cs1 = hs.ss.cs`,
				`\t\t} else {`,
				`\t\t\tsession.cs2 = hs.ss.cs`,
				`\t\t}`,
				`\t}`
			]);
			recvMessage = recvMessage.concat([
				`\tif session.mc > ${finalKex} {`,
				`\t\tif hs.i {`,
				`\t\t\ths.ss.cs = session.cs2`,
				`\t\t} else {`,
				`\t\t\ths.ss.cs = session.cs1`,
				`\t\t}`,
				`\t\ths, plaintext, valid = readMessage${util.abc[finalKex + 1]}(hs, message)`,
				`\t\tif hs.i {`,
				`\t\t\tsession.cs2 = hs.ss.cs`,
				`\t\t} else {`,
				`\t\t\tsession.cs1 = hs.ss.cs`,
				`\t\t}`,
				`\t}`
			]);
			break;
		}
	}
	sendMessage = sendMessage.concat([
		`\tsession.mc = session.mc + 1`,
		`\tsession.hs = hs`,
		`\treturn session, messageBuffer`,
		`}`
	]);
	recvMessage = recvMessage.concat([
		`\tsession.mc = session.mc + 1`,
		`\tsession.hs = hs`,
		`\treturn session, plaintext, valid`,
		`}`
	]);
	return initSession.concat(sendMessage).concat(recvMessage);
};

const parse = (pattern) => {
	let t = JSON.stringify(params);
	let s = typeFuns(pattern).join('\n');
	let i = initializeFuns(pattern).join('\n\n');
	let w = writeMessageFuns(pattern).join('\n\n');
	let r = readMessageFuns(pattern).join('\n\n');
	let e = events(pattern).join('\n');
	let g = globals(pattern).join('\n');
	let a = initiatorFun(pattern).join('\n\t');
	let b = responderFun(pattern).join('\n\t');
	let k = repeatingKeysQueryFun(pattern).join('\n\t');
	let p = processFuns(pattern).join('\n');
	let q = queries(pattern).join('\n');
	let parsed = {t, s, i, w, r, e, q, g, a, b, k, p};
	return parsed;
};

if (typeof(module) !== 'undefined') {
	// Node
	module.exports = {
		parse: parse
	};
} else {
	// Web
	NOISE2GO.parse = parse;
}

})();