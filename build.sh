curl -X DELETE "http://localhost:9200/oiwiki"
curl -H'Content-Type: application/json' -XPUT "http://localhost:9200/oiwiki" -d'
{
	"settings": {
		"analysis": {
			"analyzer": {
				"default": {
					"tokenizer": "ik_max_word",
					"filter": "custom_pinyin"
				},
				"default_search": {
					"tokenizer": "ik_max_word"
				}
			},
			"filter": {
				"custom_pinyin": {
					"type": "pinyin",
					"keep_original": true,
					"limit_first_letter_length": 16
				}
			}
		}
	}
}'