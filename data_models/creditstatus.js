module.exports = (sequelize, type) => {
  return sequelize.define('credit_status', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    percent_variant: {
      type: type.INTEGER(11),
      allowNull: false
    },
    date: {
      type: type.DATE,
      allowNull: false
    },
    NextPayDate_ts: {
      type: type.INTEGER(11),
      allowNull: true
    },
    processed: {
      type: type.BOOLEAN,
      allowNull: false
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'IX_uuid',
        fields: ['uuid','NextPayDate_ts', 'percent_variant','processed']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
