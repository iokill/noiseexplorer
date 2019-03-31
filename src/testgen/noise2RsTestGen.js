const NOISE2RSTESTGEN = {
	generate: () => {}
};


const gen = (
	json, protocolName,
	initPrologue, initStaticSk, initEphemeralPk, initRemoteStaticPk,
	respRemoteStaticPk, respStaticSk, respEphemeralPk,
	psk, messages
) => {
	let abc = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
	let rsTestCode = [];
	let initInit = `let mut initiatorSession: noiseexplorer_$NOISE2RS_N$::NoiseSession =\n\tnoiseexplorer_$NOISE2RS_N$::NoiseSession::InitSession(true, &prologue, initStaticA`;
	let initResp = `let mut responderSession: noiseexplorer_$NOISE2RS_N$::NoiseSession =\n\tnoiseexplorer_$NOISE2RS_N$::NoiseSession::InitSession(false, &prologue, respStatic`;
	let eph = [``, ``];
	if (initEphemeralPk.length > 0) {
		eph[0] = `${[
			`initiatorSession.set_ephemeral_keypair(noiseexplorer_$NOISE2RS_N$::Keypair::new_k(decode_str_32(`,
			`\t"${initEphemeralPk}"`,
			`)));`
		].join("\n\t")}`;
	}
	if (respEphemeralPk.length > 0) {
		eph[1] = `${[
			`responderSession.set_ephemeral_keypair(noiseexplorer_$NOISE2RS_N$::Keypair::new_k(decode_str_32(`,
			`\t"${respEphemeralPk}"`,
			`)));`
				].join("\n\t")}`;
	}
	rsTestCode.push(`let prologue = decode_str("${initPrologue}");`);
	if (initStaticSk.length == 0) {
		initStaticSk = `noiseexplorer_$NOISE2RS_N$::EMPTY_KEY`;
	} else {
		initStaticSk = `decode_str_32("${initStaticSk}")`;
	}
	if (respStaticSk.length == 0) {
		respStaticSk = `noiseexplorer_$NOISE2RS_N$::EMPTY_KEY`;
	} else {
		respStaticSk = `decode_str_32("${respStaticSk}")`;
	}
	rsTestCode = rsTestCode.concat([
		`let initStaticA: noiseexplorer_$NOISE2RS_N$::Keypair = noiseexplorer_$NOISE2RS_N$::Keypair::new_k(${initStaticSk});`,
		`let respStatic: noiseexplorer_$NOISE2RS_N$::Keypair = noiseexplorer_$NOISE2RS_N$::Keypair::new_k(${respStaticSk});`
	]);
	if (initRemoteStaticPk.length > 0) {
		initInit = `${initInit}, respStatic.pk.0`;
	} else {
		initInit = `${initInit}, noiseexplorer_$NOISE2RS_N$::EMPTY_KEY`;
	}
	if (respRemoteStaticPk.length > 0) {
		rsTestCode.push(`let initStaticB: noiseexplorer_$NOISE2RS_N$::Keypair = noiseexplorer_$NOISE2RS_N$::Keypair::new_k(${initStaticSk});`);
		initResp = `${initResp}, initStaticB.pk.0`;
	} else {
		initResp = `${initResp}, noiseexplorer_$NOISE2RS_N$::EMPTY_KEY`;
	}
	if (psk.length > 0) {
		rsTestCode.push(`let temp_psk1: [u8; 32] =\n\tdecode_str_32("${psk}");`);
		rsTestCode.push(`let temp_psk2: [u8; 32] =\n\tdecode_str_32("${psk}");`);
		initInit = `${initInit}, temp_psk1);`;
		initResp = `${initResp}, temp_psk2);`;
	} else {
		initInit = `${initInit});`;
		initResp = `${initResp});`;
	}
	rsTestCode.push([
		`${initInit}`,
		`${initResp}`
	].join('\n\t'));
	rsTestCode.push(eph[0]);
	rsTestCode.push(eph[1]);
	for (let i = 0; i < 6; i++) {
		let send = (i % 2 === 0) ? 'initiatorSession' : 'responderSession';
		let recv = (i % 2 === 0) ? 'responderSession' : 'initiatorSession';
		rsTestCode.push([
			`let payload${abc[i]} = decode_str("${messages[i].payload}");`,
			`let mut message${abc[i]}: noiseexplorer_$NOISE2RS_N$::MessageBuffer = ${send}.SendMessage(&payload${abc[i]});`,
			`let mut valid${abc[i]}: bool = false;`,
			`if let Some(_x) = ${recv}.RecvMessage(&mut message${abc[i]}) {\n\t\tvalid${abc[i]} = true;\n\t}`,
			`let t${abc[i]}: Vec<u8> = decode_str("${messages[i].ciphertext}");`
		].join('\n\t'));
	}
	rsTestCode.push([
		`assert!(`,
		`\tvalidA && validB && validC && validD && validE && validF,`,
		`\t"Sanity check FAIL for ${protocolName}."`,
		`);`
	].join('\n\t'));
	for (let i = 0; i < 6; i++) {
		rsTestCode.push(`let mut c${abc[i]}: Vec<u8> = Vec::new();`);
		if (json.messages.length > i) {
			if (json.messages[i].tokens.indexOf('e') >= 0) {
				rsTestCode.push(`c${abc[i]}.append(&mut Vec::from(&message${abc[i]}.ne[..]));`);
			}
			if (json.messages[i].tokens.indexOf('s') >= 0) {
				rsTestCode.push(`c${abc[i]}.append(&mut message${abc[i]}.ns);`);
			}
		}
		rsTestCode.push(`c${abc[i]}.append(&mut message${abc[i]}.ciphertext);`);
	}
	for (let i = 0; i < 6; i++) {
		rsTestCode.push(String.raw`assert!(t${abc[i]} == c${abc[i]},"\n\n\nTest ${abc[i]}: FAIL\n\nExpected:\n{:X?}\n\nActual:\n{:X?}\n\n\n", t${abc[i]}, c${abc[i]});`);
	}
	return rsTestCode.join('\n\t');
}

const assign = (json, data) => {
	let [prologue, psk] = ['', ''];
	let [initStaticSk, initEphemeralPk, initRemoteStaticPk] = ['', '', ''];
	let [respRemoteStaticPk, respStaticSk, respEphemeralPk] = ['', '', ''];
	let messages = '';
	if (data.hasOwnProperty('protocol_name')) {
		protocolName = data.protocol_name.split('_').slice(1).join('_');
	}
	if (data.hasOwnProperty('init_prologue')) {
		prologue = data.init_prologue;
	}
	if (data.hasOwnProperty('init_psks')) {
		psk = data.init_psks[0];
	}
	if (data.hasOwnProperty('init_static')) {
		initStaticSk = data.init_static;
	}
	if (data.hasOwnProperty('init_ephemeral')) {
		initEphemeralPk = data.init_ephemeral;
	}
	if (data.hasOwnProperty('init_remote_static')) {
		initRemoteStaticPk = data.init_remote_static;
	}
	if (data.hasOwnProperty('resp_remote_static')) {
		respRemoteStaticPk = data.resp_remote_static;
	}
	if (data.hasOwnProperty('resp_static')) {
		respStaticSk = data.resp_static;
	}
	if (data.hasOwnProperty('resp_ephemeral')) {
		respEphemeralPk = data.resp_ephemeral;
	}
	messages = data.messages;
	return gen(
		json, protocolName, prologue,
		initStaticSk, initEphemeralPk, initRemoteStaticPk,
		respRemoteStaticPk, respStaticSk, respEphemeralPk,
		psk, messages
	);
};

const generate = (json, code) => {
	const fs = require('fs');
	const testVectors = JSON.parse(
		fs.readFileSync('../tests/cacophony.json', 'utf-8')
	).vectors;
	for (let i = 0; i < testVectors.length; i++) {
		let patternName = code.split('\n')[1].slice(0, -1);
		let tempA = testVectors[i].protocol_name.split('_');
		if (
			tempA[1] === patternName &&
			tempA[2] === '25519' &&
			testVectors[i].protocol_name.split("_")[3] === 'ChaChaPoly' &&
			testVectors[i].protocol_name.split("_")[4] == 'BLAKE2s'
		) {
			let test = assign(json, testVectors[i]);
			return [code, test];
		}
	}
}

if (typeof (module) !== 'undefined') {
	// Node
	module.exports = {
		generate: generate
	};
} else {
	// Web
	NOISE2RSTESTGEN.generate = generate;
}